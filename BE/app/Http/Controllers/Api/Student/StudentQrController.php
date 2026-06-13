<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Services\QrCodeImageFactory;
use Illuminate\Http\Request;

class StudentQrController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        $profile = $user->studentProfile()->with('schoolClass.program')->first();

        if (! $profile) {
            return response()->json(['message' => 'Student profile not found.'], 404);
        }

        return response()->json([
            'data' => [
                'student_number' => $profile->student_number,
                'full_name' => $user->full_name,
                'program_name' => $profile->schoolClass?->program?->name,
                'year_level' => $profile->schoolClass?->year_level,
                'class_name' => $profile->schoolClass?->class_name,
                'section' => $profile->schoolClass?->section,
                'qr_payload' => 'SARS_STUDENT:'.$profile->qr_public_token,
            ],
        ]);
    }

    /**
     * Authenticated PNG for the student portal card (use with Bearer token; not for public img src).
     */
    public function qrImage(Request $request)
    {
        $user = $request->user();
        $profile = $user->studentProfile()->first();

        if (! $profile) {
            return response()->json(['message' => 'Student profile not found.'], 404);
        }

        $data = $request->validate([
            'size' => ['nullable', 'integer', 'min:128', 'max:512'],
        ]);

        $size = (int) ($data['size'] ?? 180);
        $payload = 'SARS_STUDENT:'.$profile->qr_public_token;

        return QrCodeImageFactory::pngResponse($payload, $size);
    }
}
