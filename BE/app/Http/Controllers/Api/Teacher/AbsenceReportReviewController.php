<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AbsenceReport;
use App\Models\SchoolClass;
use App\Notifications\AbsenceReportReviewed;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class AbsenceReportReviewController extends Controller
{
    public function index(Request $request)
    {
        $teacherId = $request->user()->id;

        $query = AbsenceReport::query()
            ->with(['student.studentProfile', 'schoolClass.schoolYear', 'attendanceRecord', 'attachments', 'reviewedBy'])
            ->whereHas('schoolClass', fn ($q) => $q->where('teacher_id', $teacherId))
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        }

        return response()->json([
            'data' => $query->paginate(20),
        ]);
    }

    public function approve(Request $request, AbsenceReport $absenceReport)
    {
        $teacherId = $request->user()->id;
        $class = SchoolClass::query()->whereKey($absenceReport->class_id)->firstOrFail();
        abort_unless($class->teacher_id === $teacherId, 403);

        $data = $request->validate([
            'admin_remarks' => ['nullable', 'string'],
        ]);

        $absenceReport->status = AbsenceReport::STATUS_APPROVED;
        $absenceReport->reviewed_by = $teacherId;
        $absenceReport->reviewed_at = Carbon::now();
        $absenceReport->admin_remarks = $data['admin_remarks'] ?? null;
        $absenceReport->save();

        AuditLogger::log($request->user(), 'absence_report.approve', $absenceReport, 'Approved absence report');
        $absenceReport->student?->notify(new AbsenceReportReviewed($absenceReport));

        return response()->json([
            'data' => $absenceReport->load(['student', 'attachments', 'reviewedBy']),
        ]);
    }

    public function reject(Request $request, AbsenceReport $absenceReport)
    {
        $teacherId = $request->user()->id;
        $class = SchoolClass::query()->whereKey($absenceReport->class_id)->firstOrFail();
        abort_unless($class->teacher_id === $teacherId, 403);

        $data = $request->validate([
            'admin_remarks' => ['required', 'string'],
        ]);

        $absenceReport->status = AbsenceReport::STATUS_REJECTED;
        $absenceReport->reviewed_by = $teacherId;
        $absenceReport->reviewed_at = Carbon::now();
        $absenceReport->admin_remarks = $data['admin_remarks'];
        $absenceReport->save();

        AuditLogger::log($request->user(), 'absence_report.reject', $absenceReport, 'Rejected absence report');
        $absenceReport->student?->notify(new AbsenceReportReviewed($absenceReport));

        return response()->json([
            'data' => $absenceReport->load(['student', 'attachments', 'reviewedBy']),
        ]);
    }
}

