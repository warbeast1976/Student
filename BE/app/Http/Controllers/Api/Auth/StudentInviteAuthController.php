<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\StudentPasswordSetupInvite;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StudentInviteAuthController extends Controller
{
    public function accept(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $tokenHash = hash('sha256', $data['token']);
        $invite = StudentPasswordSetupInvite::query()
            ->with('user')
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $invite) {
            throw ValidationException::withMessages([
                'token' => ['Invalid invite token.'],
            ]);
        }

        if ($invite->consumed_at !== null || $invite->status === StudentPasswordSetupInvite::STATUS_ACCEPTED) {
            throw ValidationException::withMessages([
                'token' => ['This invite has already been used.'],
            ]);
        }

        if ($invite->expires_at && now()->greaterThan($invite->expires_at)) {
            $invite->status = StudentPasswordSetupInvite::STATUS_EXPIRED;
            $invite->save();
            throw ValidationException::withMessages([
                'token' => ['This invite has expired. Request a resend from admin.'],
            ]);
        }

        $user = $invite->user;
        if (! $user || ! in_array($user->role?->name, ['student', 'teacher'], true)) {
            throw ValidationException::withMessages([
                'token' => ['Invite user is invalid.'],
            ]);
        }

        DB::transaction(function () use ($user, $invite, $data) {
            $user->password = $data['password'];
            $user->status = User::STATUS_ACTIVE;
            $user->save();

            $invite->status = StudentPasswordSetupInvite::STATUS_ACCEPTED;
            $invite->consumed_at = now();
            $invite->last_error = null;
            $invite->save();

            StudentPasswordSetupInvite::query()
                ->where('user_id', $user->id)
                ->whereKeyNot($invite->id)
                ->whereIn('status', [
                    StudentPasswordSetupInvite::STATUS_PENDING,
                    StudentPasswordSetupInvite::STATUS_SENT,
                    StudentPasswordSetupInvite::STATUS_FAILED,
                ])
                ->update([
                    'status' => StudentPasswordSetupInvite::STATUS_EXPIRED,
                    'expires_at' => now(),
                ]);
        });

        return response()->json(['ok' => true, 'message' => 'Password has been set. You can now sign in.']);
    }
}

