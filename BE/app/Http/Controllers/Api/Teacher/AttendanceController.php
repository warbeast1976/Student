<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Notifications\AttendanceMarkedAbsent;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'attendance_date' => ['nullable', 'date'],
            'from' => ['nullable', 'date', 'required_with:to'],
            'to' => ['nullable', 'date', 'required_with:from', 'after_or_equal:from'],
            'status' => ['nullable', Rule::in([
                AttendanceRecord::STATUS_PRESENT,
                AttendanceRecord::STATUS_ABSENT,
                AttendanceRecord::STATUS_LATE,
                AttendanceRecord::STATUS_EXCUSED,
            ])],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $teacherId = $request->user()->id;
        $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();
        abort_unless($class->teacher_id === $teacherId, 403);

        $query = AttendanceRecord::query()
            ->with(['student.role', 'student.studentProfile'])
            ->where('class_id', $class->id)
            ->where('teacher_id', $teacherId)
            ->orderByDesc('attendance_date')
            ->orderBy('student_id');

        if (! empty($data['attendance_date'])) {
            $query->where('attendance_date', Carbon::parse($data['attendance_date'])->toDateString());
        } elseif (! empty($data['from']) && ! empty($data['to'])) {
            $query->whereBetween('attendance_date', [
                Carbon::parse($data['from'])->toDateString(),
                Carbon::parse($data['to'])->toDateString(),
            ]);
        }

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (! empty($data['search'])) {
            $search = trim((string) $data['search']);
            $query->where(function ($q) use ($search) {
                $q->whereHas('student', function ($sq) use ($search) {
                    $sq->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%");
                })->orWhereHas('student.studentProfile', function ($sq) use ($search) {
                    $sq->where('student_number', 'like', "%{$search}%");
                });
            });
        }

        $perPage = (int) ($data['per_page'] ?? 50);

        return response()->json(['data' => $query->paginate($perPage)]);
    }

    public function mark(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'school_year_id' => ['required', 'integer', 'exists:school_years,id'],
            'attendance_date' => ['required', 'date'],
            'records' => ['required', 'array', 'min:1'],
            'records.*.student_id' => ['required', 'integer', 'exists:users,id'],
            'records.*.status' => ['required', Rule::in([
                AttendanceRecord::STATUS_PRESENT,
                AttendanceRecord::STATUS_ABSENT,
                AttendanceRecord::STATUS_LATE,
                AttendanceRecord::STATUS_EXCUSED,
            ])],
            'records.*.remarks' => ['nullable', 'string'],
        ]);

        $teacherId = $request->user()->id;
        $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();
        abort_unless($class->teacher_id === $teacherId, 403);

        $year = SchoolYear::query()->whereKey($data['school_year_id'])->firstOrFail();
        abort_unless($class->school_year_id === $year->id, 422);

        $date = Carbon::parse($data['attendance_date'])->toDateString();

        $saved = [];
        foreach ($data['records'] as $row) {
            $profile = StudentProfile::query()->where('user_id', $row['student_id'])->first();
            if (! $profile || (int) $profile->class_id !== (int) $class->id) {
                return response()->json([
                    'message' => "Student {$row['student_id']} is not in this class.",
                ], 422);
            }

            $record = AttendanceRecord::query()
                ->where('student_id', $row['student_id'])
                ->where('class_id', $class->id)
                ->where('attendance_date', $date)
                ->first();
            $oldStatus = $record?->status;

            if ($record) {
                $record->fill([
                    'teacher_id' => $teacherId,
                    'school_year_id' => $year->id,
                    'status' => $row['status'],
                    'remarks' => $row['remarks'] ?? null,
                ])->save();
            } else {
                $record = AttendanceRecord::query()->create([
                    'student_id' => $row['student_id'],
                    'class_id' => $class->id,
                    'attendance_date' => $date,
                    'teacher_id' => $teacherId,
                    'school_year_id' => $year->id,
                    'status' => $row['status'],
                    'remarks' => $row['remarks'] ?? null,
                ]);
            }

            if ($record->status === AttendanceRecord::STATUS_ABSENT && $oldStatus !== AttendanceRecord::STATUS_ABSENT) {
                $record->loadMissing('student.studentProfile');
                $record->student?->notify(new AttendanceMarkedAbsent($record));
            }

            $saved[] = $record;
        }

        AuditLogger::log($request->user(), 'attendance.mark', $class, "Marked attendance for {$date}");

        return response()->json([
            'data' => $saved,
        ], 201);
    }
}

