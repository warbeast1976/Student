<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AbsenceReport;
use Illuminate\Http\Request;

class AbsenceReportExportController extends Controller
{
    public function export(Request $request)
    {
        $data = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected'],
            'class_id' => ['nullable', 'integer'],
            'student_id' => ['nullable', 'integer'],
        ]);

        $query = AbsenceReport::query()
            ->with(['student.studentProfile', 'schoolClass', 'reviewedBy'])
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

        $filename = 'absence_reports_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'id',
                'status',
                'student_id',
                'student_number',
                'student_name',
                'class_id',
                'reason',
                'reviewed_by',
                'reviewed_at',
                'admin_remarks',
                'created_at',
            ]);

            $query->chunk(500, function ($reports) use ($out) {
                foreach ($reports as $r) {
                    fputcsv($out, [
                        $r->id,
                        $r->status,
                        $r->student_id,
                        $r->student?->studentProfile?->student_number,
                        $r->student?->full_name,
                        $r->class_id,
                        $r->reason,
                        $r->reviewed_by,
                        optional($r->reviewed_at)->toDateTimeString(),
                        $r->admin_remarks,
                        optional($r->created_at)->toDateTimeString(),
                    ]);
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}

