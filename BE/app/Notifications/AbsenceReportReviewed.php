<?php

namespace App\Notifications;

use App\Models\AbsenceReport;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AbsenceReportReviewed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private AbsenceReport $report)
    {
    }

    public function via(mixed $notifiable): array
    {
        return ['mail', SmsChannel::class];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Absence report ' . strtoupper($this->report->status))
            ->line('Your absence report was ' . $this->report->status . '.')
            ->line($this->report->admin_remarks ? ('Remarks: ' . $this->report->admin_remarks) : '');
    }

    public function toSms(mixed $notifiable): array
    {
        $msg = 'Absence report ' . strtoupper($this->report->status);
        if ($this->report->admin_remarks) {
            $msg .= ' - ' . $this->report->admin_remarks;
        }

        return [
            'to' => method_exists($notifiable, 'routeNotificationForSms') ? $notifiable->routeNotificationForSms() : null,
            'message' => $msg,
        ];
    }
}

