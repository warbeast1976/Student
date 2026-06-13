<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SchoolYear;
use Illuminate\Http\Request;

class SchoolYearController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => SchoolYear::query()->orderByDesc('start_date')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:school_years,name'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $year = SchoolYear::create($data);

        if (($data['is_active'] ?? false) === true) {
            SchoolYear::query()->whereKeyNot($year->id)->update(['is_active' => false]);
        }

        return response()->json(['data' => $year], 201);
    }

    public function show(SchoolYear $schoolYear)
    {
        return response()->json(['data' => $schoolYear]);
    }

    public function update(Request $request, SchoolYear $schoolYear)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', 'unique:school_years,name,' . $schoolYear->id],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['sometimes', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $schoolYear->fill($data);
        $schoolYear->save();

        if (array_key_exists('is_active', $data) && $data['is_active'] === true) {
            SchoolYear::query()->whereKeyNot($schoolYear->id)->update(['is_active' => false]);
        }

        return response()->json(['data' => $schoolYear]);
    }

    public function destroy(SchoolYear $schoolYear)
    {
        $schoolYear->delete();

        return response()->json(['ok' => true]);
    }

    public function setActive(SchoolYear $schoolYear)
    {
        SchoolYear::query()->update(['is_active' => false]);
        $schoolYear->is_active = true;
        $schoolYear->save();

        return response()->json(['data' => $schoolYear]);
    }
}

