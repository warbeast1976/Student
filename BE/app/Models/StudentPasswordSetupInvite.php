<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentPasswordSetupInvite extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_EXPIRED = 'expired';

    protected $fillable = [
        'user_id',
        'email',
        'token_hash',
        'status',
        'expires_at',
        'sent_at',
        'consumed_at',
        'last_error',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'sent_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

