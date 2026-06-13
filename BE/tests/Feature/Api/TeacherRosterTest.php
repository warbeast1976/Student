<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\TeacherProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherRosterTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_view_roster_for_own_class(): void
    {
        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-2000']);

        $year = SchoolYear::query()->create([
            'name' => 'SY R',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'Roster',
            'grade_level' => '10',
            'section' => 'A',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-2000',
        ]);

        Sanctum::actingAs($teacher);
        $this->getJson("/api/teacher/classes/{$class->id}/roster")
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['class_id', 'school_year_id', 'count']]);
    }

    public function test_teacher_cannot_view_roster_for_other_teachers_class(): void
    {
        $teacherRole = Role::query()->create(['name' => 'teacher']);

        $teacherA = User::factory()->create(['role_id' => $teacherRole->id]);
        $teacherB = User::factory()->create(['role_id' => $teacherRole->id]);

        $year = SchoolYear::query()->create([
            'name' => 'SY R2',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacherA->id,
            'class_name' => 'Roster2',
            'grade_level' => '10',
            'section' => 'B',
        ]);

        Sanctum::actingAs($teacherB);
        $this->getJson("/api/teacher/classes/{$class->id}/roster")->assertForbidden();
    }
}

