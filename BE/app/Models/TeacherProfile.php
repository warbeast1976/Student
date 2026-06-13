<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class TeacherProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'employee_id',
        'qr_public_token',
        'contact_number',
        'address',
    ];

    protected static function booted(): void
    {
        static::creating(function (TeacherProfile $profile) {
            if (empty($profile->qr_public_token)) {
                $profile->qr_public_token = Str::random(48);
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}