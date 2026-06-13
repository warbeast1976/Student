<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class StudentScheduleController extends Controller
{
    public function index(Request $request)
    {
        $profile = $request->user()
            ->studentProfile()
            ->with([
                'schoolClass.program',
                'schoolClass.teacher',
                'schoolClass.timetableSlots.subject',
                'schoolClass.timetableSlots.teacher',
            ])
            ->first();

        if (! $profile || ! $profile->schoolClass) {
            return response()->json([
                'data' => [
                    'class' => null,
                    'slots' => [],
                ],
            ]);
        }

        $c = $profile->schoolClass;
        $slots = $c->timetableSlots->sort(function ($a, $b) {
            if ($a->day_of_week !== $b->day_of_week) {
                return $a->day_of_week <=> $b->day_of_week;
            }

            return strcmp((string) $a->start_time, (string) $b->start_time);
        })->values();

        return response()->json([
            'data' => [
                'class' => [
                    'id' => $c->id,
                    'class_name' => $c->class_name,
                    'section' => $c->section,
                    'year_level' => $c->year_level,
                    'program' => $c->program,
                    'adviser' => $c->teacher,
                ],
                'slots' => $slots,
            ],
        ]);
    }
}
