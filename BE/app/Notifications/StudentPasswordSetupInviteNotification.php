<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StudentPasswordSetupInviteNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $setupUrl,
        private readonly string $recipientName,
        private readonly string $expiryLabel
    ) {
    }

    public function via(mixed $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Set up your MLGCL portal password')
            ->greeting('Hello '.$this->recipientName.',')
            ->line('A portal account was created for you.')
            ->line('To activate your login, please set your password using the button below.')
            ->action('Set password', $this->setupUrl)
            ->line('This link expires on '.$this->expiryLabel.'.')
            ->line('If you did not request this, you can ignore this email.');
    }
}

