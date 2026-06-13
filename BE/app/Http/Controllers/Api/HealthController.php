<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LogSmsSender;
use App\Services\SmsSender;
use App\Services\TwilioSmsSender;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    /**
     * Basic liveness plus non-secret integration hints so operators know whether
     * email/SMS are configured for real delivery or dev logging only.
     */
    public function __invoke(): JsonResponse
    {
        $showDetails = (bool) config('app.health_show_integration_hints', true);

        if (! $showDetails) {
            return response()->json([
                'ok' => true,
            ]);
        }

        $mailDriver = (string) config('mail.default', 'log');
        $smsSender = app(SmsSender::class);
        $smsMode = $smsSender instanceof TwilioSmsSender ? 'twilio' : 'log';

        $mailSendsReal = ! in_array($mailDriver, ['log', 'array'], true);

        return response()->json([
            'ok' => true,
            'integrations' => [
                'mail_driver' => $mailDriver,
                'mail_sends_real_email' => $mailSendsReal,
                'sms_mode' => $smsMode,
                'sms_sends_real_sms' => $smsSender instanceof TwilioSmsSender,
                'sms_note' => $smsSender instanceof LogSmsSender
                    ? 'Twilio env vars missing; SMS is logged to laravel.log only. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM for production.'
                    : null,
                'mail_note' => ! $mailSendsReal
                    ? 'MAIL_MAILER is log/array; emails are not delivered. Use smtp, ses, postmark, etc. for production.'
                    : null,
            ],
        ]);
    }
}
