<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\SchoolClass;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AttendanceExportController extends Controller
{
    public function export(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $teacherId = $request->user()->id;
        $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();
        abort_unless((int) $class->teacher_id === (int) $teacherId, 403);

        $from = Carbon::parse($data['from'])->toDateString();
        $to = Carbon::parse($data['to'])->toDateString();

        $query = AttendanceRecord::query()
            ->with(['student.studentProfile'])
            ->where('class_id', $class->id)
            ->where('teacher_id', $teacherId)
            ->whereBetween('attendance_date', [$from, $to])
            ->orderBy('attendance_date')
            ->orderBy('student_id');

        $filename = "attendance_class_{$class->id}_{$from}_to_{$to}.csv";

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'attendance_date',
                'student_id',
                'student_number',
                'student_name',
                'status',
                'remarks',
            ]);

            $query->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $r) {
                    $studentNumber = $r->student?->studentProfile?->student_number;
                    $studentName = $r->student?->full_name;
                    fputcsv($out, [
                        $r->attendance_date?->toDateString(),
                        $r->student_id,
                        $studentNumber,
                        $studentName,
                        $r->status,
                        $r->remarks,
                    ]);
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}

