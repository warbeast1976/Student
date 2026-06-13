<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class LogSmsSender implements SmsSender
{
    public function send(string $to, string $message): void
    {
        Log::info('SMS', [
            'to' => $to,
            'message' => $message,
        ]);
    }
}

