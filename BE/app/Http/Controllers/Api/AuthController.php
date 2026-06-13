<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['nullable', 'email'],
            'login' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        $credential = trim((string) ($data['email'] ?? $data['login'] ?? ''));

        if ($credential === '') {
            throw ValidationException::withMessages([
                'email' => ['Email or login is required.'],
            ]);
        }

        $with = [
            'role',
            'studentProfile.schoolClass.program',
            'studentProfile.schoolClass.teacher',
            'teacherProfile',
        ];

        /** @var User|null $user */
        $user = User::query()
            ->with($with)
            ->where('email', $credential)
            ->first();

        if (! $user && ! str_contains($credential, '@')) {
            $profile = StudentProfile::query()->where('student_number', $credential)->first();
            if ($profile) {
                $user = User::query()
                    ->with($with)
                    ->whereKey($profile->user_id)
                    ->first();
            }
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->isActive()) {
            return response()->json(['message' => 'Account is inactive.'], 403);
        }

        $token = $user->createToken($data['device_name'] ?? 'api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request)
    {
        $user = $request->user()?->load([
            'role',
            'studentProfile.schoolClass.program',
            'studentProfile.schoolClass.teacher',
            'teacherProfile',
        ]);

        return response()->json(['user' => $user]);
    }

    /**
     * Update the authenticated user's account and (for students/teachers) safe profile fields.
     * Class, student number, employee ID, and role remain admin-managed.
     */
    public function updateProfile(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $user->loadMissing('role');
        $roleName = $user->role?->name;

        $rules = [
            'first_name' => ['sometimes', 'string', 'max:255'],
            'last_name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['required_with:password', 'string'],
            'password' => ['nullable', 'string', 'min:6'],
        ];

        if ($roleName === 'student') {
            $rules['student_profile'] = ['sometimes', 'array'];
            $rules['student_profile.gender'] = ['nullable', Rule::in(['male', 'female', 'other'])];
            $rules['student_profile.birth_date'] = ['nullable', 'date'];
            $rules['student_profile.contact_number'] = ['nullable', 'string', 'max:255'];
            $rules['student_profile.guardian_name'] = ['nullable', 'string', 'max:255'];
            $rules['student_profile.guardian_contact_number'] = ['nullable', 'string', 'max:255'];
            $rules['student_profile.address'] = ['nullable', 'string'];
        }

        if ($roleName === 'teacher') {
            $rules['teacher_profile'] = ['sometimes', 'array'];
            $rules['teacher_profile.contact_number'] = ['nullable', 'string', 'max:255'];
            $rules['teacher_profile.address'] = ['nullable', 'string'];
        }

        $data = $request->validate($rules);

        if (! empty($data['password'])) {
            if (! Hash::check($data['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['Current password is incorrect.'],
                ]);
            }
            $user->password = $data['password'];
        }

        foreach (['first_name', 'last_name', 'email'] as $field) {
            if (array_key_exists($field, $data)) {
                $user->{$field} = $data[$field];
            }
        }
        $user->save();

        if ($roleName === 'student' && isset($data['student_profile']) && $user->studentProfile) {
            $allowed = ['gender', 'birth_date', 'contact_number', 'guardian_name', 'guardian_contact_number', 'address'];
            $payload = array_intersect_key($data['student_profile'], array_flip($allowed));
            if ($payload !== []) {
                $user->studentProfile->fill($payload);
                $user->studentProfile->save();
            }
        }

        if ($roleName === 'teacher' && isset($data['teacher_profile']) && $user->teacherProfile) {
            $payload = array_intersect_key(
                $data['teacher_profile'],
                array_flip(['contact_number', 'address'])
            );
            if ($payload !== []) {
                $user->teacherProfile->fill($payload);
                $user->teacherProfile->save();
            }
        }

        return $this->me($request);
    }
}
