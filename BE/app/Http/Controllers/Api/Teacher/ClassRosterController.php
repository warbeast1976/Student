<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\StudentProfile;
use Illuminate\Http\Request;

class ClassRosterController extends Controller
{
    public function index(Request $request, SchoolClass $class)
    {
        $teacherId = $request->user()->id;
        abort_unless((int) $class->teacher_id === (int) $teacherId, 403);

        $rows = StudentProfile::query()
            ->with(['user:id,first_name,last_name,email,status'])
            ->where('class_id', $class->id)
            ->orderBy('student_number')
            ->get()
            ->map(fn (StudentProfile $p) => [
                'student_id' => $p->user_id,
                'student_number' => $p->student_number,
                'full_name' => $p->user?->full_name,
                'status' => $p->user?->status,
            ])
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'class_id' => $class->id,
                'school_year_id' => $class->school_year_id,
                'count' => $rows->count(),
            ],
        ]);
    }
}

