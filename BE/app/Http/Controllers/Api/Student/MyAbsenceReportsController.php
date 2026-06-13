<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\AbsenceAttachment;
use App\Models\AbsenceReport;
use App\Models\AttendanceRecord;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use App\Models\StudentProfile;

class MyAbsenceReportsController extends Controller
{
    public function index(Request $request)
    {
        $studentId = $request->user()->id;

        $query = AbsenceReport::query()
            ->with(['attendanceRecord', 'schoolClass.schoolYear', 'attachments', 'reviewedBy'])
            ->where('student_id', $studentId)
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json([
            'data' => $query->paginate(20),
        ]);
    }

    public function store(Request $request)
    {
        $studentId = $request->user()->id;

        $data = $request->validate([
            'attendance_record_id' => ['required', 'integer', 'exists:attendance_records,id'],
            'reason' => ['required', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['file', 'max:10240'],
        ]);

        /** @var AttendanceRecord $attendance */
        $attendance = AttendanceRecord::query()->whereKey($data['attendance_record_id'])->firstOrFail();

        if ($attendance->student_id !== $studentId) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $profile = StudentProfile::query()->where('user_id', $studentId)->first();
        if (! $profile || (int) $profile->class_id !== (int) $attendance->class_id) {
            return response()->json(['message' => 'Student is not assigned to this class.'], 422);
        }

        if ($attendance->absenceReport()->exists()) {
            return response()->json(['message' => 'Absence report already submitted for this attendance record.'], 422);
        }

        if (! $attendance->isAbsent()) {
            return response()->json(['message' => 'Absence report can only be submitted for absent records.'], 422);
        }

        $report = AbsenceReport::create([
            'attendance_record_id' => $attendance->id,
            'student_id' => $studentId,
            'class_id' => $attendance->class_id,
            'submitted_by' => $studentId,
            'reason' => $data['reason'],
            'status' => AbsenceReport::STATUS_PENDING,
        ]);

        $files = $request->file('attachments', []);
        foreach ($files as $file) {
            $path = $file->store('absence_attachments/' . $report->id, 'public');
            AbsenceAttachment::create([
                'absence_report_id' => $report->id,
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $path,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);
        }

        AuditLogger::log($request->user(), 'absence_report.submit', $report, 'Submitted absence report');

        return response()->json([
            'data' => $report->load(['attendanceRecord', 'attachments']),
        ], 201);
    }
}

