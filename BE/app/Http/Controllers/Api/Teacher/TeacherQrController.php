<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Services\QrCodeImageFactory;
use Illuminate\Http\Request;

class TeacherQrController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        $profile = $user->teacherProfile()->first();

        if (! $profile) {
            return response()->json(['message' => 'Teacher profile not found.'], 404);
        }

        return response()->json([
            'data' => [
                'employee_id' => $profile->employee_id,
                'full_name' => $user->full_name,
                'address' => $profile->address,
                'role' => 'teacher',
                'qr_payload' => 'SARS_TEACHER:'.$profile->qr_public_token,
            ],
        ]);
    }

    /**
     * Authenticated PNG for the teacher portal card (use with Bearer token).
     */
    public function qrImage(Request $request)
    {
        $user = $request->user();
        $profile = $user->teacherProfile()->first();

        if (! $profile) {
            return response()->json(['message' => 'Teacher profile not found.'], 404);
        }

        $data = $request->validate([
            'size' => ['nullable', 'integer', 'min:128', 'max:512'],
        ]);

        $size = (int) ($data['size'] ?? 180);
        $payload = 'SARS_TEACHER:'.$profile->qr_public_token;

        return QrCodeImageFactory::pngResponse($payload, $size);
    }
}
