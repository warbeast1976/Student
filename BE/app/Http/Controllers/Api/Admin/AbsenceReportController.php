<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\AbsenceReport;
use App\Notifications\AbsenceReportReviewed;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AbsenceReportController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'status' => ['nullable', 'string'],
            'class_id' => ['nullable', 'integer'],
            'student_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date', 'required_with:to'],
            'to' => ['nullable', 'date', 'required_with:from', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = AbsenceReport::query()
            ->with(['student.studentProfile', 'schoolClass.schoolYear', 'attendanceRecord', 'attachments', 'reviewedBy'])
            ->orderByDesc('id');

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (! empty($data['class_id'])) {
            $query->where('class_id', (int) $data['class_id']);
        }

        if (! empty($data['student_id'])) {
            $query->where('student_id', (int) $data['student_id']);
        }

        if (! empty($data['from']) && ! empty($data['to'])) {
            $query->whereBetween('created_at', [
                Carbon::parse($data['from'])->startOfDay(),
                Carbon::parse($data['to'])->endOfDay(),
            ]);
        }

        if (! empty($data['search'])) {
            $search = trim((string) $data['search']);
            $query->where(function ($q) use ($search) {
                $q->whereHas('student', function ($sq) use ($search) {
                    $sq->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                })->orWhereHas('student.studentProfile', function ($sq) use ($search) {
                    $sq->where('student_number', 'like', "%{$search}%");
                })->orWhere('reason', 'like', "%{$search}%");
            });
        }

        $riskWindowStart = Carbon::today()->subDays(13)->toDateString();
        $riskQuery = AttendanceRecord::query()
            ->with(['student', 'student.studentProfile', 'schoolClass'])
            ->whereBetween('attendance_date', [$riskWindowStart, Carbon::today()->toDateString()]);

        if (! empty($data['class_id'])) {
            $riskQuery->where('class_id', (int) $data['class_id']);
        }

        if (! empty($data['student_id'])) {
            $riskQuery->where('student_id', (int) $data['student_id']);
        }

        $riskRows = $riskQuery
            ->orderBy('student_id')
            ->orderByDesc('attendance_date')
            ->get(['student_id', 'class_id', 'attendance_date', 'status']);

        $grouped = [];
        foreach ($riskRows as $row) {
            $grouped[$row->student_id][] = $row;
        }

        $atRisk = [];
        foreach ($grouped as $studentId => $rows) {
            $recentAbsences = 0;
            $consecutiveAbsences = 0;
            foreach ($rows as $idx => $row) {
                if ($row->status === AttendanceRecord::STATUS_ABSENT) {
                    $recentAbsences++;
                    if ($idx === 0 || $consecutiveAbsences > 0) {
                        $consecutiveAbsences++;
                    }
                } elseif ($idx === 0) {
                    $consecutiveAbsences = 0;
                }
            }
            $riskScore = ($recentAbsences * 2) + ($consecutiveAbsences * 3);
            if ($recentAbsences >= 3 || $consecutiveAbsences >= 2 || $riskScore >= 8) {
                $first = $rows[0];
                $student = $first->student;
                $profile = $student?->studentProfile;
                $atRisk[] = [
                    'student_id' => (int) $studentId,
                    'class_id' => (int) $first->class_id,
                    'class_name' => $first->schoolClass?->class_name,
                    'student_name' => $student?->full_name ?? 'Student',
                    'student_number' => $profile?->student_number,
                    'recent_absences' => $recentAbsences,
                    'consecutive_absences' => $consecutiveAbsences,
                    'risk_score' => $riskScore,
                    'risk_level' => $riskScore >= 12 ? 'high' : ($riskScore >= 8 ? 'medium' : 'low'),
                ];
            }
        }
        usort($atRisk, fn (array $a, array $b) => $b['risk_score'] <=> $a['risk_score']);
        $atRisk = array_slice($atRisk, 0, 15);

        return response()->json([
            'data' => $query->paginate((int) ($data['per_page'] ?? 20)),
            'summary' => [
                'at_risk_students' => $atRisk,
            ],
        ]);
    }

    public function show(AbsenceReport $absenceReport)
    {
        return response()->json([
            'data' => $absenceReport->load(['student.studentProfile', 'schoolClass.schoolYear', 'attendanceRecord', 'attachments', 'reviewedBy']),
        ]);
    }

    public function approve(Request $request, AbsenceReport $absenceReport)
    {
        $data = $request->validate([
            'admin_remarks' => ['nullable', 'string'],
        ]);

        $absenceReport->status = AbsenceReport::STATUS_APPROVED;
        $absenceReport->reviewed_by = $request->user()->id;
        $absenceReport->reviewed_at = Carbon::now();
        $absenceReport->admin_remarks = $data['admin_remarks'] ?? null;
        $absenceReport->save();

        AuditLogger::log($request->user(), 'absence_report.approve', $absenceReport, 'Approved absence report (admin)');
        $absenceReport->student?->notify(new AbsenceReportReviewed($absenceReport));

        return response()->json([
            'data' => $absenceReport->load(['student', 'attachments', 'reviewedBy']),
        ]);
    }

    public function reject(Request $request, AbsenceReport $absenceReport)
    {
        $data = $request->validate([
            'admin_remarks' => ['required', 'string'],
        ]);

        $absenceReport->status = AbsenceReport::STATUS_REJECTED;
        $absenceReport->reviewed_by = $request->user()->id;
        $absenceReport->reviewed_at = Carbon::now();
        $absenceReport->admin_remarks = $data['admin_remarks'];
        $absenceReport->save();

        AuditLogger::log($request->user(), 'absence_report.reject', $absenceReport, 'Rejected absence report (admin)');
        $absenceReport->student?->notify(new AbsenceReportReviewed($absenceReport));

        return response()->json([
            'data' => $absenceReport->load(['student', 'attachments', 'reviewedBy']),
        ]);
    }
}

