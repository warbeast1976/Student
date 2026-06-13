<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'role_id',
        'first_name',
        'last_name',
        'email',
        'password',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    protected $appends = [
        'full_name',
    ];

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name . ' ' . $this->last_name);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function teacherProfile(): HasOne
    {
        return $this->hasOne(TeacherProfile::class);
    }

    public function studentProfile(): HasOne
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function handledClasses(): HasMany
    {
        return $this->hasMany(SchoolClass::class, 'teacher_id');
    }

    public function classSubjectAssignments(): HasMany
    {
        return $this->hasMany(ClassSubjectTeacher::class, 'teacher_id');
    }

    public function timetableSlotsTeaching(): HasMany
    {
        return $this->hasMany(TimetableSlot::class, 'teacher_id');
    }

    public function attendanceRecordsAsStudent(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'student_id');
    }

    public function attendanceRecordsAsTeacher(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'teacher_id');
    }

    public function absenceReportsAsStudent(): HasMany
    {
        return $this->hasMany(AbsenceReport::class, 'student_id');
    }

    public function submittedAbsenceReports(): HasMany
    {
        return $this->hasMany(AbsenceReport::class, 'submitted_by');
    }

    public function reviewedAbsenceReports(): HasMany
    {
        return $this->hasMany(AbsenceReport::class, 'reviewed_by');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function isAdmin(): bool
    {
        return $this->role?->name === 'admin';
    }

    public function isTeacher(): bool
    {
        return $this->role?->name === 'teacher';
    }

    public function isStudent(): bool
    {
        return $this->role?->name === 'student';
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * @return array<int, string>
     */
    public function routeNotificationForSms(): array
    {
        $numbers = [];
        $contact = $this->studentProfile?->contact_number;
        $guardian = $this->studentProfile?->guardian_contact_number;

        foreach ([$contact, $guardian] as $n) {
            $n = trim((string) $n);
            if ($n !== '') {
                $numbers[] = $n;
            }
        }

        return array_values(array_unique($numbers));
    }
}