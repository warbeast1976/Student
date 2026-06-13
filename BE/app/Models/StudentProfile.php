<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class StudentProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'class_id',
        'student_number',
        'qr_public_token',
        'gender',
        'birth_date',
        'contact_number',
        'guardian_name',
        'guardian_contact_number',
        'address',
    ];

    protected static function booted(): void
    {
        static::creating(function (StudentProfile $profile) {
            if (empty($profile->qr_public_token)) {
                $profile->qr_public_token = Str::random(48);
            }
        });
    }

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }
}