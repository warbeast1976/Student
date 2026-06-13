<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassSubjectTeacher;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ClassSubjectTeacherController extends Controller
{
    public const MAX_SUBJECTS_PER_TEACHER_PER_YEAR = 3;

    public function index(Request $request)
    {
        $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
        ]);

        $rows = ClassSubjectTeacher::query()
            ->where('class_id', $request->integer('class_id'))
            ->with(['subject', 'teacher'])
            ->orderBy('subject_id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'teacher_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $teacher = User::query()->with('role')->findOrFail($data['teacher_id']);
        if (! $teacher->isTeacher()) {
            throw ValidationException::withMessages(['teacher_id' => ['Must be a teacher user.']]);
        }

        $class = SchoolClass::query()->findOrFail($data['class_id']);
        $schoolYearId = $class->school_year_id;

        $distinctSubjects = ClassSubjectTeacher::query()
            ->where('teacher_id', $data['teacher_id'])
            ->whereHas('schoolClass', fn ($q) => $q->where('school_year_id', $schoolYearId))
            ->pluck('subject_id');

        if (! $distinctSubjects->contains($data['subject_id']) && $distinctSubjects->unique()->count() >= self::MAX_SUBJECTS_PER_TEACHER_PER_YEAR) {
            throw ValidationException::withMessages([
                'teacher_id' => ['This teacher already teaches the maximum number of distinct subjects ('.self::MAX_SUBJECTS_PER_TEACHER_PER_YEAR.') for this school year.'],
            ]);
        }

        $row = ClassSubjectTeacher::query()->updateOrCreate(
            [
                'class_id' => $data['class_id'],
                'subject_id' => $data['subject_id'],
            ],
            ['teacher_id' => $data['teacher_id']]
        );

        return response()->json([
            'data' => $row->load(['subject', 'teacher', 'schoolClass']),
        ], 201);
    }

    public function destroy(ClassSubjectTeacher $classSubjectTeacher)
    {
        $classSubjectTeacher->delete();

        return response()->json(['ok' => true]);
    }
}
