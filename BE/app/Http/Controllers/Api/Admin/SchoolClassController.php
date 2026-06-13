<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Http\Request;

class SchoolClassController extends Controller
{
    public function index(Request $request)
    {
        $query = SchoolClass::query()->with(['teacher.role', 'schoolYear', 'program']);

        if ($request->filled('school_year_id')) {
            $query->where('school_year_id', $request->integer('school_year_id'));
        }

        if ($request->filled('teacher_id')) {
            $query->where('teacher_id', $request->integer('teacher_id'));
        }

        if ($request->filled('q')) {
            $q = $request->string('q')->toString();
            $query->where(function ($w) use ($q) {
                $w->where('class_name', 'like', "%{$q}%")
                    ->orWhere('grade_level', 'like', "%{$q}%")
                    ->orWhere('section', 'like', "%{$q}%");
            });
        }

        return response()->json([
            'data' => $query->orderByDesc('id')->paginate(20),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'school_year_id' => ['required', 'integer', 'exists:school_years,id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id'],
            'year_level' => ['nullable', 'integer', 'min:1', 'max:8'],
            'teacher_id' => ['required', 'integer', 'exists:users,id'],
            'class_name' => ['required', 'string', 'max:255'],
            'grade_level' => ['required', 'string', 'max:255'],
            'section' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $teacher = User::query()->with('role')->findOrFail($data['teacher_id']);
        if (! $teacher->isTeacher()) {
            return response()->json(['message' => 'teacher_id must be a teacher user.'], 422);
        }

        $class = SchoolClass::create($data);

        return response()->json([
            'data' => $class->load(['teacher.role', 'schoolYear', 'program']),
        ], 201);
    }

    public function show(SchoolClass $class)
    {
        return response()->json([
            'data' => $class->load(['teacher.role', 'schoolYear', 'program']),
        ]);
    }

    public function update(Request $request, SchoolClass $class)
    {
        $data = $request->validate([
            'school_year_id' => ['sometimes', 'integer', 'exists:school_years,id'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id'],
            'year_level' => ['nullable', 'integer', 'min:1', 'max:8'],
            'teacher_id' => ['sometimes', 'integer', 'exists:users,id'],
            'class_name' => ['sometimes', 'string', 'max:255'],
            'grade_level' => ['sometimes', 'string', 'max:255'],
            'section' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        if (array_key_exists('teacher_id', $data)) {
            $teacher = User::query()->with('role')->findOrFail($data['teacher_id']);
            if (! $teacher->isTeacher()) {
                return response()->json(['message' => 'teacher_id must be a teacher user.'], 422);
            }
        }

        $class->fill($data);
        $class->save();

        return response()->json([
            'data' => $class->load(['teacher.role', 'schoolYear', 'program']),
        ]);
    }

    public function destroy(SchoolClass $class)
    {
        $class->delete();

        return response()->json(['ok' => true]);
    }
}

