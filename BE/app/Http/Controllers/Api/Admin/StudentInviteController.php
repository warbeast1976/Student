<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\StudentPasswordSetupInvite;
use App\Models\User;
use App\Notifications\StudentPasswordSetupInviteNotification;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class StudentInviteController extends Controller
{
    private const EXPIRY_HOURS = 48;

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
        $status = trim((string) $request->query('status', ''));
        $query = StudentPasswordSetupInvite::query()
            ->with(['user:id,first_name,last_name,email,status'])
            ->orderByDesc('id');

        if ($status !== '') {
            $query->where('status', $status);
        }

        return response()->json([
            'data' => $query->limit(100)->get(),
        ]);
    }

    public function bulkCreate(Request $request)
    {
        $data = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.email' => ['required', 'email', 'max:255'],
            'rows.*.first_name' => ['required', 'string', 'max:255'],
            'rows.*.last_name' => ['required', 'string', 'max:255'],
        ]);

        $studentRoleId = Role::query()->where('name', 'student')->value('id');
        if (! $studentRoleId) {
            return response()->json(['message' => 'Student role is not configured.'], 422);
        }

        $created = 0;
        $updated = 0;
        $invitesSent = 0;
        $inviteFailures = 0;
        $errors = [];

        foreach ($data['rows'] as $i => $row) {
            $rowNum = $i + 1;
            $email = strtolower(trim((string) $row['email']));
            $first = trim((string) $row['first_name']);
            $last = trim((string) $row['last_name']);

            try {
                DB::transaction(function () use (
                    $email,
                    $first,
                    $last,
                    $studentRoleId,
                    $request,
                    &$created,
                    &$updated,
                    &$invitesSent,
                    &$inviteFailures
                ) {
                    $user = User::query()->where('email', $email)->first();
                    if (! $user) {
                        $user = User::query()->create([
                            'role_id' => $studentRoleId,
                            'first_name' => $first,
                            'last_name' => $last,
                            'email' => $email,
                            'password' => Hash::make(Str::random(40)),
                            'status' => User::STATUS_INACTIVE,
                        ]);
                        $created++;
                    } else {
                        $user->role_id = $studentRoleId;
                        $user->first_name = $first;
                        $user->last_name = $last;
                        $user->status = User::STATUS_INACTIVE;
                        $user->password = Hash::make(Str::random(40));
                        $user->save();
                        $updated++;
                    }

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
                        'email' => $email,
                        'token_hash' => hash('sha256', $plainToken),
                        'status' => StudentPasswordSetupInvite::STATUS_PENDING,
                        'expires_at' => now()->addHours(self::EXPIRY_HOURS),
                    ]);

                    $setupUrl = $this->buildPasswordSetupUrl($plainToken);
                    try {
                        Notification::route('mail', $email)
                            ->notify(new StudentPasswordSetupInviteNotification(
                                $setupUrl,
                                trim($first . ' ' . $last),
                                $invite->expires_at?->format('M d, Y h:i A')
                            ));
                        $invite->status = StudentPasswordSetupInvite::STATUS_SENT;
                        $invite->sent_at = now();
                        $invite->last_error = null;
                        $invite->save();
                        $invitesSent++;
                    } catch (\Throwable $mailError) {
                        $invite->status = StudentPasswordSetupInvite::STATUS_FAILED;
                        $invite->last_error = $mailError->getMessage();
                        $invite->save();
                        $inviteFailures++;
                    }
                });
            } catch (\Throwable $e) {
                $errors[] = ['row' => $rowNum, 'error' => $e->getMessage()];
            }
        }

        AuditLogger::log(
            $request->user(),
            'students.bulk_invite',
            null,
            "Bulk student invite: created={$created}, updated={$updated}, sent={$invitesSent}, failed={$inviteFailures}"
        );

        return response()->json([
            'created' => $created,
            'updated' => $updated,
            'invites_sent' => $invitesSent,
            'invite_failures' => $inviteFailures,
            'errors' => $errors,
        ]);
    }

    public function resend(Request $request, StudentPasswordSetupInvite $invite)
    {
        $user = $invite->user;
        if (! $user) {
            return response()->json(['message' => 'Invite user not found.'], 404);
        }

        if (! in_array($user->role?->name, ['student', 'teacher'], true)) {
            return response()->json(['message' => 'Invite is only available for teacher or student accounts.'], 422);
        }

        $newInvite = $this->createAndSendInvite($user, $request->user()?->id);

        AuditLogger::log($request->user(), 'users.invite_resend', $user, "Resent password setup invite for {$user->email}");

        return response()->json([
            'data' => $newInvite->load('user:id,first_name,last_name,email,status'),
        ]);
    }

    public function resendForUser(Request $request, User $user)
    {
        if (! in_array($user->role?->name, ['student', 'teacher'], true)) {
            return response()->json(['message' => 'Password setup invite is only available for teacher or student accounts.'], 422);
        }

        $newInvite = $this->createAndSendInvite($user, $request->user()?->id);

        AuditLogger::log($request->user(), 'users.invite_resend', $user, "Resent password setup invite for {$user->email}");

        return response()->json([
            'data' => $newInvite->load('user:id,first_name,last_name,email,status'),
        ]);
    }

    private function createAndSendInvite(User $user, ?int $createdBy): StudentPasswordSetupInvite
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
        $newInvite = StudentPasswordSetupInvite::query()->create([
            'user_id' => $user->id,
            'created_by' => $createdBy,
            'email' => $user->email,
            'token_hash' => hash('sha256', $plainToken),
            'status' => StudentPasswordSetupInvite::STATUS_PENDING,
            'expires_at' => now()->addHours(self::EXPIRY_HOURS),
        ]);

        $setupUrl = $this->buildPasswordSetupUrl($plainToken);
        try {
            Notification::route('mail', $user->email)
                ->notify(new StudentPasswordSetupInviteNotification(
                    $setupUrl,
                    trim($user->first_name . ' ' . $user->last_name),
                    $newInvite->expires_at?->format('M d, Y h:i A')
                ));
            $newInvite->status = StudentPasswordSetupInvite::STATUS_SENT;
            $newInvite->sent_at = now();
            $newInvite->last_error = null;
            $newInvite->save();
        } catch (\Throwable $mailError) {
            $newInvite->status = StudentPasswordSetupInvite::STATUS_FAILED;
            $newInvite->last_error = $mailError->getMessage();
            $newInvite->save();
        }
        return $newInvite;
    }
}

