<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MyAttendanceController extends Controller
{
    public function index(Request $request)
    {
        $studentId = $request->user()->id;
        $data = $request->validate([
            'school_year_id' => ['nullable', 'integer'],
            'class_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in([
                AttendanceRecord::STATUS_PRESENT,
                AttendanceRecord::STATUS_ABSENT,
                AttendanceRecord::STATUS_LATE,
                AttendanceRecord::STATUS_EXCUSED,
            ])],
            'from' => ['nullable', 'date', 'required_with:to'],
            'to' => ['nullable', 'date', 'required_with:from', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = AttendanceRecord::query()
            ->with(['schoolClass.schoolYear', 'teacher'])
            ->where('student_id', $studentId)
            ->orderByDesc('attendance_date');

        if (! empty($data['school_year_id'])) {
            $query->where('school_year_id', (int) $data['school_year_id']);
        }

        if (! empty($data['class_id'])) {
            $query->where('class_id', (int) $data['class_id']);
        }

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (! empty($data['from']) && ! empty($data['to'])) {
            $query->whereBetween('attendance_date', [$data['from'], $data['to']]);
        }

        return response()->json([
            'data' => $query->paginate((int) ($data['per_page'] ?? 20)),
        ]);
    }
}

