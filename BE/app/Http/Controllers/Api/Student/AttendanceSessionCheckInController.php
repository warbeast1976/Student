<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\StudentProfile;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AttendanceSessionCheckInController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'qr_payload' => ['required', 'string', 'max:500'],
        ]);

        $studentId = $request->user()->id;

        $prefix = 'SARS_ATTENDANCE_SESSION:';
        if (! str_starts_with($data['qr_payload'], $prefix)) {
            return response()->json(['message' => 'Invalid QR payload.'], 422);
        }

        $rawToken = substr($data['qr_payload'], strlen($prefix));
        if (! $rawToken) {
            return response()->json(['message' => 'Invalid QR payload.'], 422);
        }

        $tokenHash = hash('sha256', $rawToken);

        /** @var AttendanceSession|null $session */
        $session = AttendanceSession::query()
            ->with(['schoolClass'])
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $now = Carbon::now();
        if (! $session->isOpen() || $now->greaterThan($session->ends_at) || $now->lessThan($session->starts_at)) {
            return response()->json(['message' => 'Session is closed or expired.'], 422);
        }

        $profile = StudentProfile::query()->where('user_id', $studentId)->first();
        if (! $profile || (int) $profile->class_id !== (int) $session->class_id) {
            return response()->json(['message' => 'You are not assigned to this class.'], 403);
        }

        // Late rule: after 10 minutes from session start => late
        $status = $now->diffInMinutes($session->starts_at) > 10
            ? AttendanceRecord::STATUS_LATE
            : AttendanceRecord::STATUS_PRESENT;

        $record = AttendanceRecord::query()->updateOrCreate(
            [
                'student_id' => $studentId,
                'class_id' => $session->class_id,
                'attendance_date' => $session->attendance_date->toDateString(),
            ],
            [
                'teacher_id' => $session->teacher_id,
                'school_year_id' => $session->school_year_id,
                'status' => $status,
                'remarks' => 'Checked in via QR session',
            ]
        );

        AuditLogger::log($request->user(), 'attendance_session.check_in', $session, "Checked in (status={$status})");

        return response()->json([
            'data' => $record,
            'status' => $status,
        ], 201);
    }
}

