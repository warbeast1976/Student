<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DashboardStatsController extends Controller
{
    public function index(Request $request)
    {
        $studentId = $request->user()->id;
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $monthStart = isset($data['from'])
            ? Carbon::parse($data['from'])->startOfMonth()
            : Carbon::today()->startOfMonth()->subMonths(5);
        $monthEnd = isset($data['to'])
            ? Carbon::parse($data['to'])->endOfMonth()
            : Carbon::today()->endOfMonth();

        if ($monthStart->diffInMonths($monthEnd) > 11) {
            return response()->json([
                'message' => 'Date range must not exceed 12 months.',
            ], 422);
        }

        $records = AttendanceRecord::query()
            ->where('student_id', $studentId)
            ->whereBetween('attendance_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->get(['attendance_date', 'status']);

        $labels = [];
        $values = [];
        $months = $monthStart->diffInMonths($monthEnd) + 1;
        for ($i = 0; $i < $months; $i++) {
            $month = $monthStart->copy()->addMonths($i);
            $labels[] = $month->format('M');
            $values[] = 0;
        }

        foreach ($records as $record) {
            $date = Carbon::parse($record->attendance_date);
            $index = ($date->year - $monthStart->year) * 12 + ($date->month - $monthStart->month);
            if ($index >= 0 && $index < $months) {
                $values[$index]++;
            }
        }

        $total = $records->count();
        $present = $records->where('status', AttendanceRecord::STATUS_PRESENT)->count();
        $attendanceRate = $total > 0 ? round(($present / $total) * 100, 2) : 0;

        return response()->json([
            'data' => [
                'chart' => [
                    'labels' => $labels,
                    'values' => $values,
                    'label' => 'Monthly attendance records',
                ],
                'summary' => [
                    'total_records' => $total,
                    'present_records' => $present,
                    'attendance_rate' => $attendanceRate,
                ],
                'range' => [
                    'from' => $monthStart->toDateString(),
                    'to' => $monthEnd->toDateString(),
                ],
            ],
        ]);
    }
}
