<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\StudentProfile;
use App\Models\StudentPasswordSetupInvite;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Notifications\StudentPasswordSetupInviteNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private function buildPasswordSetupUrl(string $plainToken): string
    {
        $frontUrl = trim((string) config('app.frontend_url'));
        $frontUrl = $frontUrl === '' ? '' : rtrim($frontUrl, '/');

        // Only enforce "public URL" constraint in production.
        if (app()->environment('production')) {
            if (preg_match('/^(https?:\\/\\/)?(127\\.0\\.0\\.1|localhost)(:\\d+)?(\\/|$)/i', $frontUrl)) {
                $frontUrl = '';
            }
        }

        if ($frontUrl === '') {
            $frontUrl = rtrim((string) config('app.url'), '/');
        }

        // Frontend uses hash routing.
        return $frontUrl . '/#/setup-password?token=' . urlencode($plainToken);
    }

    public function index(Request $request)
    {
        $query = User::query()->with(['role', 'studentProfile.schoolClass', 'teacherProfile']);

        if ($request->filled('role')) {
            $query->whereHas('role', fn ($q) => $q->where('name', $request->string('role')));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('q')) {
            $q = $request->string('q')->toString();
            $query->where(function ($w) use ($q) {
                $w->where('first_name', 'like', "%{$q}%")
                    ->orWhere('last_name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%");
            });
        }

        return response()->json([
            'data' => $query->orderBy('id', 'desc')->paginate(20),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:6'],
            'status' => ['nullable', Rule::in([User::STATUS_ACTIVE, User::STATUS_INACTIVE])],

            'student_profile' => ['nullable', 'array'],
            'student_profile.class_id' => ['required_if:student_profile,array', 'integer', 'exists:classes,id'],
            'student_profile.student_number' => ['nullable', 'string', 'max:255', 'unique:student_profiles,student_number'],
            'student_profile.gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'student_profile.birth_date' => ['nullable', 'date'],
            'student_profile.contact_number' => ['nullable', 'string', 'max:255'],
            'student_profile.guardian_name' => ['nullable', 'string', 'max:255'],
            'student_profile.guardian_contact_number' => ['nullable', 'string', 'max:255'],
            'student_profile.address' => ['nullable', 'string'],

            'teacher_profile' => ['nullable', 'array'],
            'teacher_profile.employee_id' => ['nullable', 'string', 'max:255', 'unique:teacher_profiles,employee_id'],
            'teacher_profile.contact_number' => ['nullable', 'string', 'max:255'],
            'teacher_profile.address' => ['nullable', 'string'],
        ]);
        $role = Role::find($data['role_id']);
        $isInviteRole = in_array($role?->name, ['student', 'teacher'], true);
        if (! $isInviteRole && empty($data['password'])) {
            return response()->json([
                'message' => 'Password is required for this role.',
            ], 422);
        }

        $user = User::create([
            'role_id' => $data['role_id'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'password' => $isInviteRole ? Hash::make(Str::random(40)) : $data['password'],
            'status' => $isInviteRole ? User::STATUS_INACTIVE : ($data['status'] ?? User::STATUS_ACTIVE),
        ]);

        if ($role?->name === 'student') {
            $profile = $data['student_profile'] ?? [];
            $classId = (int) ($profile['class_id'] ?? 0);
            if (! $classId) {
                $classId = (int) SchoolClass::query()->value('id');
            }
            if (! $classId) {
                return response()->json([
                    'message' => 'No class found. Create a class first before adding students.',
                ], 422);
            }
            if (empty($profile['student_number'])) {
                $profile['student_number'] = $this->generateUniqueStudentNumber();
            }
            StudentProfile::create([
                'user_id' => $user->id,
                ...$profile,
                'class_id' => $classId,
            ]);
        }

        if ($role?->name === 'teacher') {
            $profile = $data['teacher_profile'] ?? [];
            if (empty($profile['employee_id'])) {
                $profile['employee_id'] = $this->generateUniqueEmployeeId();
            }
            TeacherProfile::create(['user_id' => $user->id, ...$profile]);
        }

        $inviteSent = false;
        $inviteError = null;
        if ($isInviteRole) {
            $inviteResult = $this->sendPasswordSetupInvite($user, $request);
            $inviteSent = (bool) $inviteResult['sent'];
            $inviteError = $inviteResult['error'];
        }

        return response()->json([
            'data' => $user->load(['role', 'studentProfile.schoolClass', 'teacherProfile']),
            'setup_invite_sent' => $inviteSent,
            'setup_invite_error' => $inviteError,
        ], 201);
    }

    public function show(User $user)
    {
        return response()->json([
            'data' => $user->load(['role', 'studentProfile.schoolClass', 'teacherProfile']),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'role_id' => ['sometimes', 'integer', 'exists:roles,id'],
            'first_name' => ['sometimes', 'string', 'max:255'],
            'last_name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'status' => ['sometimes', Rule::in([User::STATUS_ACTIVE, User::STATUS_INACTIVE])],

            'student_profile' => ['nullable', 'array'],
            'student_profile.class_id' => ['sometimes', 'integer', 'exists:classes,id'],
            'student_profile.student_number' => ['sometimes', 'string', 'max:255', Rule::unique('student_profiles', 'student_number')->ignore($user->studentProfile?->id)],
            'student_profile.gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'student_profile.birth_date' => ['nullable', 'date'],
            'student_profile.contact_number' => ['nullable', 'string', 'max:255'],
            'student_profile.guardian_name' => ['nullable', 'string', 'max:255'],
            'student_profile.guardian_contact_number' => ['nullable', 'string', 'max:255'],
            'student_profile.address' => ['nullable', 'string'],

            'teacher_profile' => ['nullable', 'array'],
            'teacher_profile.employee_id' => ['sometimes', 'string', 'max:255', Rule::unique('teacher_profiles', 'employee_id')->ignore($user->teacherProfile?->id)],
            'teacher_profile.contact_number' => ['nullable', 'string', 'max:255'],
            'teacher_profile.address' => ['nullable', 'string'],
        ]);

        if (array_key_exists('password', $data) && $data['password'] === null) {
            unset($data['password']);
        }

        $user->fill($data);
        $user->save();

        if (array_key_exists('student_profile', $data)) {
            $profileData = $data['student_profile'];
            if ($profileData === null) {
                $user->studentProfile()?->delete();
            } else {
                $user->studentProfile()->updateOrCreate(['user_id' => $user->id], $profileData);
            }
        }

        if (array_key_exists('teacher_profile', $data)) {
            $profileData = $data['teacher_profile'];
            if ($profileData === null) {
                $user->teacherProfile()?->delete();
            } else {
                if (empty($profileData['employee_id']) && ! $user->teacherProfile?->employee_id) {
                    $profileData['employee_id'] = $this->generateUniqueEmployeeId();
                }
                $user->teacherProfile()->updateOrCreate(['user_id' => $user->id], $profileData);
            }
        }

        return response()->json([
            'data' => $user->load(['role', 'studentProfile.schoolClass', 'teacherProfile']),
        ]);
    }

    public function destroy(User $user)
    {
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['ok' => true]);
    }

    private function generateUniqueStudentNumber(): string
    {
        $year = now()->format('y');
        do {
            $candidate = $year.'-'.str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        } while (StudentProfile::query()->where('student_number', $candidate)->exists());

        return $candidate;
    }

    private function generateUniqueEmployeeId(): string
    {
        do {
            $candidate = 'T-'.strtoupper(Str::random(6));
        } while (TeacherProfile::query()->where('employee_id', $candidate)->exists());

        return $candidate;
    }

    private function sendPasswordSetupInvite(User $user, Request $request): array
    {
        StudentPasswordSetupInvite::query()
            ->where('user_id', $user->id)
            ->whereIn('status', [
                StudentPasswordSetupInvite::STATUS_PENDING,
                StudentPasswordSetupInvite::STATUS_SENT,
                StudentPasswordSetupInvite::STATUS_FAILED,
            ])
            ->update([
                'status' => StudentPasswordSetupInvite::STATUS_EXPIRED,
                'expires_at' => now(),
            ]);

        $plainToken = Str::random(64);
        $invite = StudentPasswordSetupInvite::query()->create([
            'user_id' => $user->id,
            'created_by' => $request->user()?->id,
            'email' => $user->email,
            'token_hash' => hash('sha256', $plainToken),
            'status' => StudentPasswordSetupInvite::STATUS_PENDING,
            'expires_at' => now()->addHours(48),
        ]);

        $setupUrl = $this->buildPasswordSetupUrl($plainToken);
        try {
            Notification::route('mail', $user->email)
                ->notify(new StudentPasswordSetupInviteNotification(
                    $setupUrl,
                    trim($user->first_name.' '.$user->last_name),
                    $invite->expires_at?->format('M d, Y h:i A')
                ));
            $invite->status = StudentPasswordSetupInvite::STATUS_SENT;
            $invite->sent_at = now();
            $invite->last_error = null;
            $invite->save();

            return [
                'sent' => true,
                'error' => null,
            ];
        } catch (\Throwable $mailError) {
            $invite->status = StudentPasswordSetupInvite::STATUS_FAILED;
            $invite->last_error = $mailError->getMessage();
            $invite->save();

            return [
                'sent' => false,
                'error' => $mailError->getMessage(),
            ];
        }
    }
}

