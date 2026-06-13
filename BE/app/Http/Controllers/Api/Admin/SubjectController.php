<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubjectController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Subject::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:50', Rule::unique('subjects', 'code')],
            'name' => ['required', 'string', 'max:255', Rule::unique('subjects', 'name')],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $subject = Subject::query()->create($validated);

        return response()->json(['data' => $subject->fresh()], 201);
    }

    public function update(Request $request, Subject $subject)
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:50', Rule::unique('subjects', 'code')->ignore($subject->id)],
            'name' => ['required', 'string', 'max:255', Rule::unique('subjects', 'name')->ignore($subject->id)],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $subject->update($validated);

        return response()->json(['data' => $subject->fresh()]);
    }

    public function destroy(Subject $subject)
    {
        $subject->delete();

        return response()->json(['ok' => true]);
    }
}
