<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ClassSubjectTeacher;
use App\Models\TimetableSlot;
use Illuminate\Http\Request;

class TeacherTeachingController extends Controller
{
    public function index(Request $request)
    {
        $id = $request->user()->id;

        $assignments = ClassSubjectTeacher::query()
            ->where('teacher_id', $id)
            ->with(['subject', 'schoolClass.program', 'schoolClass.schoolYear'])
            ->orderBy('class_id')
            ->get();

        $slots = TimetableSlot::query()
            ->where('teacher_id', $id)
            ->with(['subject', 'schoolClass'])
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'data' => [
                'subject_assignments' => $assignments,
                'timetable_slots' => $slots,
            ],
        ]);
    }
}
