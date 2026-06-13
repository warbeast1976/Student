<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SchoolClass extends Model
{
    use HasFactory;

    protected $table = 'classes';

    protected $fillable = [
        'school_year_id',
        'program_id',
        'year_level',
        'teacher_id',
        'class_name',
        'grade_level',
        'section',
        'description',
    ];

    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subjectTeachers()
    {
        return $this->hasMany(ClassSubjectTeacher::class, 'class_id');
    }

    public function timetableSlots()
    {
        return $this->hasMany(TimetableSlot::class, 'class_id');
    }

    public function studentProfiles(): HasMany
    {
        return $this->hasMany(StudentProfile::class, 'class_id');
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'class_id');
    }

    public function absenceReports(): HasMany
    {
        return $this->hasMany(AbsenceReport::class, 'class_id');
    }
}