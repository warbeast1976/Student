<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\TimetableSlot;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TimetableSlotController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
        ]);

        $rows = TimetableSlot::query()
            ->where('class_id', $request->integer('class_id'))
            ->with(['subject', 'teacher'])
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'day_of_week' => ['required', 'integer', 'min:1', 'max:7'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'teacher_id' => ['required', 'integer', 'exists:users,id'],
            'room' => ['nullable', 'string', 'max:64'],
        ]);

        if ($data['end_time'] <= $data['start_time']) {
            throw ValidationException::withMessages(['end_time' => ['End time must be after start time.']]);
        }

        $teacher = User::query()->with('role')->findOrFail($data['teacher_id']);
        if (! $teacher->isTeacher()) {
            throw ValidationException::withMessages(['teacher_id' => ['Must be a teacher user.']]);
        }

        $slot = TimetableSlot::create($data);

        return response()->json([
            'data' => $slot->load(['subject', 'teacher', 'schoolClass']),
        ], 201);
    }

    public function update(Request $request, TimetableSlot $timetableSlot)
    {
        $data = $request->validate([
            'day_of_week' => ['sometimes', 'integer', 'min:1', 'max:7'],
            'start_time' => ['sometimes', 'date_format:H:i'],
            'end_time' => ['sometimes', 'date_format:H:i'],
            'subject_id' => ['sometimes', 'integer', 'exists:subjects,id'],
            'teacher_id' => ['sometimes', 'integer', 'exists:users,id'],
            'room' => ['nullable', 'string', 'max:64'],
        ]);

        if (array_key_exists('teacher_id', $data)) {
            $teacher = User::query()->with('role')->findOrFail($data['teacher_id']);
            if (! $teacher->isTeacher()) {
                throw ValidationException::withMessages(['teacher_id' => ['Must be a teacher user.']]);
            }
        }

        if (isset($data['start_time'], $data['end_time']) && $data['end_time'] <= $data['start_time']) {
            throw ValidationException::withMessages(['end_time' => ['End time must be after start time.']]);
        }

        $timetableSlot->fill($data);
        $timetableSlot->save();

        return response()->json([
            'data' => $timetableSlot->load(['subject', 'teacher', 'schoolClass']),
        ]);
    }

    public function destroy(TimetableSlot $timetableSlot)
    {
        $timetableSlot->delete();

        return response()->json(['ok' => true]);
    }
}
