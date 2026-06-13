<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\ProgramCurriculum;
use Illuminate\Http\Request;

class StudentSubjectsController extends Controller
{
    public function index(Request $request)
    {
        $profile = $request->user()->studentProfile()->with('schoolClass.program')->first();

        if (! $profile || ! $profile->schoolClass || ! $profile->schoolClass->program_id || ! $profile->schoolClass->year_level) {
            return response()->json(['data' => []]);
        }

        $programId = $profile->schoolClass->program_id;
        $yearLevel = $profile->schoolClass->year_level;

        $rows = ProgramCurriculum::query()
            ->where('program_id', $programId)
            ->where('year_level', $yearLevel)
            ->with('subject')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows]);
    }
}
