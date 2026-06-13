<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassAnnouncementComment extends Model
{
    use HasFactory;

    public const STATUS_VISIBLE = 'visible';
    public const STATUS_HIDDEN = 'hidden';

    protected $fillable = [
        'announcement_id',
        'student_id',
        'body',
        'status',
        'moderated_by',
        'moderated_at',
    ];

    protected function casts(): array
    {
        return [
            'moderated_at' => 'datetime',
        ];
    }

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(ClassAnnouncement::class, 'announcement_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function moderator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'moderated_by');
    }
}

