<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\AbsenceAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AbsenceAttachmentController extends Controller
{
    public function show(Request $request, AbsenceAttachment $attachment)
    {
        $studentId = $request->user()->id;
        $report = $attachment->absenceReport()->firstOrFail();

        if ((int) $report->student_id !== (int) $studentId) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! Storage::disk('public')->exists($attachment->file_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::disk('public')->download(
            $attachment->file_path,
            $attachment->file_name
        );
    }
}

