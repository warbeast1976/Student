<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Program extends Model
{
    protected $fillable = [
        'code',
        'name',
        'duration_years',
        'description',
    ];

    public function curriculumRows(): HasMany
    {
        return $this->hasMany(ProgramCurriculum::class);
    }

    public function schoolClasses(): HasMany
    {
        return $this->hasMany(SchoolClass::class, 'program_id');
    }
}
