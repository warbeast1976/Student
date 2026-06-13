<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\SchoolClass;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DashboardStatsController extends Controller
{
    public function index(Request $request)
    {
        $teacherId = $request->user()->id;
        $data = $request->validate([
            'class_id' => ['nullable', 'integer', 'exists:classes,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $end = isset($data['to']) ? Carbon::parse($data['to'])->endOfDay() : Carbon::today()->endOfDay();
        $start = isset($data['from']) ? Carbon::parse($data['from'])->startOfDay() : Carbon::today()->subDays(6)->startOfDay();

        if ($start->diffInDays($end) > 31) {
            return response()->json([
                'message' => 'Date range must not exceed 31 days.',
            ], 422);
        }

        $query = AttendanceRecord::query()
            ->where('teacher_id', $teacherId)
            ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()]);

        if (! empty($data['class_id'])) {
            $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();
            abort_unless((int) $class->teacher_id === (int) $teacherId, 403);
            $query->where('class_id', (int) $data['class_id']);
        }

        $records = $query->get(['attendance_date', 'status']);

        $labels = [];
        $counts = [];
        $totalDays = $start->diffInDays($end) + 1;
        for ($i = 0; $i < $totalDays; $i++) {
            $day = $start->copy()->addDays($i);
            $labels[] = $day->format('M d');
            $counts[] = 0;
        }

        foreach ($records as $record) {
            $dayIndex = Carbon::parse($record->attendance_date)->diffInDays($start, false);
            if ($dayIndex >= 0 && $dayIndex < $totalDays) {
                $counts[$dayIndex]++;
            }
        }

        $statusCounts = [
            AttendanceRecord::STATUS_PRESENT => 0,
            AttendanceRecord::STATUS_ABSENT => 0,
            AttendanceRecord::STATUS_LATE => 0,
            AttendanceRecord::STATUS_EXCUSED => 0,
        ];

        foreach ($records as $record) {
            if (array_key_exists($record->status, $statusCounts)) {
                $statusCounts[$record->status]++;
            }
        }

        $recentWindowStart = $end->copy()->subDays(13)->toDateString();
        $riskRecords = AttendanceRecord::query()
            ->with(['student', 'student.studentProfile'])
            ->where('teacher_id', $teacherId)
            ->whereBetween('attendance_date', [$recentWindowStart, $end->toDateString()]);

        if (! empty($data['class_id'])) {
            $riskRecords->where('class_id', (int) $data['class_id']);
        }

        $riskRows = $riskRecords
            ->orderBy('student_id')
            ->orderByDesc('attendance_date')
            ->get(['student_id', 'attendance_date', 'status']);

        $riskByStudent = [];
        foreach ($riskRows as $row) {
            $riskByStudent[$row->student_id][] = $row;
        }

        $atRisk = [];
        foreach ($riskByStudent as $studentId => $studentRows) {
            $recentAbsences = 0;
            $consecutiveAbsences = 0;
            foreach ($studentRows as $idx => $row) {
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
                $student = $studentRows[0]->student;
                $profile = $student?->studentProfile;
                $atRisk[] = [
                    'student_id' => (int) $studentId,
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
        $atRisk = array_slice($atRisk, 0, 10);

        return response()->json([
            'data' => [
                'chart' => [
                    'labels' => $labels,
                    'values' => $counts,
                    'label' => 'Attendance records',
                ],
                'status_counts' => $statusCounts,
                'range' => [
                    'from' => $start->toDateString(),
                    'to' => $end->toDateString(),
                ],
                'at_risk_students' => $atRisk,
            ],
        ]);
    }
}
