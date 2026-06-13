<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use Illuminate\Http\Request;

class MyClassesController extends Controller
{
    public function index(Request $request)
    {
        $teacherId = $request->user()->id;

        return response()->json([
            'data' => SchoolClass::query()
                ->with(['schoolYear'])
                ->where('teacher_id', $teacherId)
                ->orderByDesc('id')
                ->get(),
        ]);
    }
}

