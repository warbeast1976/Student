<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassAnnouncement extends Model
{
    use HasFactory;

    protected $fillable = [
        'class_id',
        'created_by',
        'title',
        'body',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reads(): HasMany
    {
        return $this->hasMany(ClassAnnouncementRead::class, 'announcement_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(ClassAnnouncementComment::class, 'announcement_id');
    }

    public function isPublished(): bool
    {
        return $this->published_at !== null;
    }
}

