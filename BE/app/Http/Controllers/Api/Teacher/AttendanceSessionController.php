<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSession;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Services\AuditLogger;
use App\Services\QrCodeImageFactory;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class AttendanceSessionController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'school_year_id' => ['required', 'integer', 'exists:school_years,id'],
            'attendance_date' => ['required', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:1', 'max:240'],
        ]);

        $teacherId = $request->user()->id;
        $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();
        abort_unless($class->teacher_id === $teacherId, 403);

        $year = SchoolYear::query()->whereKey($data['school_year_id'])->firstOrFail();
        abort_unless($class->school_year_id === $year->id, 422);

        $now = Carbon::now();
        $duration = (int) ($data['duration_minutes'] ?? 15);
        $endsAt = (clone $now)->addMinutes($duration);

        $rawToken = Str::uuid()->toString() . '.' . Str::random(32);
        $tokenHash = hash('sha256', $rawToken);

        $session = AttendanceSession::create([
            'class_id' => $class->id,
            'teacher_id' => $teacherId,
            'school_year_id' => $year->id,
            'attendance_date' => Carbon::parse($data['attendance_date'])->toDateString(),
            'token_hash' => $tokenHash,
            'token_ciphertext' => Crypt::encryptString($rawToken),
            'starts_at' => $now,
            'ends_at' => $endsAt,
            'status' => AttendanceSession::STATUS_OPEN,
        ]);

        AuditLogger::log($request->user(), 'attendance_session.open', $session, "Opened attendance session ({$duration} mins)");

        // This is what you encode as the QR text.
        $qrPayload = "SARS_ATTENDANCE_SESSION:{$rawToken}";

        return response()->json([
            'data' => $session,
            'qr_payload' => $qrPayload,
            'expires_at' => $endsAt,
        ], 201);
    }

    public function close(Request $request, AttendanceSession $attendanceSession)
    {
        $teacherId = $request->user()->id;
        abort_unless((int) $attendanceSession->teacher_id === (int) $teacherId, 403);

        $attendanceSession->status = AttendanceSession::STATUS_CLOSED;
        $attendanceSession->ends_at = Carbon::now();
        $attendanceSession->save();

        AuditLogger::log($request->user(), 'attendance_session.close', $attendanceSession, 'Closed attendance session');

        return response()->json(['data' => $attendanceSession]);
    }

    public function qr(Request $request, AttendanceSession $attendanceSession)
    {
        $teacherId = $request->user()->id;
        abort_unless((int) $attendanceSession->teacher_id === (int) $teacherId, 403);

        $data = $request->validate([
            'format' => ['nullable', 'in:png,svg'],
            'size' => ['nullable', 'integer', 'min:128', 'max:1024'],
        ]);

        if (! $attendanceSession->token_ciphertext) {
            return response()->json(['message' => 'QR token not available for this session.'], 422);
        }

        $rawToken = Crypt::decryptString($attendanceSession->token_ciphertext);
        $qrPayload = "SARS_ATTENDANCE_SESSION:{$rawToken}";

        $format = $data['format'] ?? 'svg';
        $size = (int) ($data['size'] ?? 320);

        return QrCodeImageFactory::svgOrPngResponse($qrPayload, $format, $size);
    }
}

