<?php

namespace App\Notifications;

use App\Models\ClassAnnouncement;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AnnouncementPublished extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private ClassAnnouncement $announcement)
    {
    }

    public function via(mixed $notifiable): array
    {
        return ['mail', SmsChannel::class];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New class announcement: ' . $this->announcement->title)
            ->line($this->announcement->body);
    }

    public function toSms(mixed $notifiable): array
    {
        return [
            'to' => method_exists($notifiable, 'routeNotificationForSms') ? $notifiable->routeNotificationForSms() : null,
            'message' => 'New announcement: ' . $this->announcement->title,
        ];
    }
}

