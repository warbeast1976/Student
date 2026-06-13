<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceSession extends Model
{
    use HasFactory;

    public const STATUS_OPEN = 'open';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'class_id',
        'teacher_id',
        'school_year_id',
        'attendance_date',
        'token_hash',
        'token_ciphertext',
        'starts_at',
        'ends_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }
}

