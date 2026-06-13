<?php

namespace App\Notifications\Channels;

use App\Services\SmsSender;
use Illuminate\Notifications\Notification;

class SmsChannel
{
    public function __construct(private SmsSender $sender)
    {
    }

    public function send(mixed $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toSms')) {
            return;
        }

        $payload = $notification->toSms($notifiable);
        $message = (string) ($payload['message'] ?? '');
        $to = $payload['to'] ?? null;

        $targets = [];
        if (is_string($to) && $to !== '') {
            $targets = [$to];
        } elseif (is_array($to)) {
            $targets = array_values(array_filter($to, fn ($v) => is_string($v) && trim($v) !== ''));
        } elseif (method_exists($notifiable, 'routeNotificationForSms')) {
            $targets = (array) $notifiable->routeNotificationForSms();
        }

        foreach ($targets as $t) {
            $this->sender->send((string) $t, $message);
        }
    }
}

