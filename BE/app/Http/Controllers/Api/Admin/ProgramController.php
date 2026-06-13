<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Program;

class ProgramController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Program::query()->orderBy('name')->get(),
        ]);
    }
}
