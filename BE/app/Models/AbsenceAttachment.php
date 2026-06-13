<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AbsenceAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'absence_report_id',
        'file_name',
        'file_path',
        'file_type',
        'file_size',
    ];

    public function absenceReport(): BelongsTo
    {
        return $this->belongsTo(AbsenceReport::class, 'absence_report_id');
    }
}