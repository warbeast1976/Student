<?php

namespace App\Notifications;

use App\Models\AttendanceRecord;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AttendanceMarkedAbsent extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private AttendanceRecord $record)
    {
    }

    public function via(mixed $notifiable): array
    {
        return ['mail', SmsChannel::class];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        $date = optional($this->record->attendance_date)->format('M d, Y') ?: (string) $this->record->attendance_date;

        return (new MailMessage)
            ->subject('Absence alert: attendance marked absent')
            ->line("Attendance for {$date} has been marked as ABSENT.")
            ->line($this->record->remarks ? ('Remarks: ' . $this->record->remarks) : '');
    }

    public function toSms(mixed $notifiable): array
    {
        $date = optional($this->record->attendance_date)->format('Y-m-d') ?: (string) $this->record->attendance_date;
        $message = "Absence alert: marked ABSENT on {$date}.";
        if ($this->record->remarks) {
            $message .= ' Remarks: ' . $this->record->remarks;
        }

        return [
            'to' => method_exists($notifiable, 'routeNotificationForSms') ? $notifiable->routeNotificationForSms() : null,
            'message' => $message,
        ];
    }
}
