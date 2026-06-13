<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramCurriculum extends Model
{
    protected $table = 'program_curriculum';

    protected $fillable = [
        'program_id',
        'year_level',
        'subject_id',
        'sort_order',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
