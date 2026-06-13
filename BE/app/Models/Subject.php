<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subject extends Model
{
    protected $fillable = [
        'code',
        'name',
        'description',
    ];

    public function curriculumRows(): HasMany
    {
        return $this->hasMany(ProgramCurriculum::class);
    }

    public function timetableSlots(): HasMany
    {
        return $this->hasMany(TimetableSlot::class);
    }

    public function classAssignments(): HasMany
    {
        return $this->hasMany(ClassSubjectTeacher::class);
    }
}
