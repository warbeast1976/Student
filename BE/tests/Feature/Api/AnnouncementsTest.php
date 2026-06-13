<?php

namespace Tests\Feature\Api;

use App\Models\ClassAnnouncement;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AnnouncementsTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_create_publish_and_student_can_read(): void
    {
        $adminRole = Role::query()->create(['name' => 'admin']);
        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-4000']);

        $year = SchoolYear::query()->create([
            'name' => 'SY Ann',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'History',
            'grade_level' => '10',
            'section' => 'D',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-4000',
        ]);

        // Teacher creates announcement (draft)
        Sanctum::actingAs($teacher);
        $create = $this->postJson('/api/teacher/announcements', [
            'class_id' => $class->id,
            'title' => 'Quiz',
            'body' => 'Quiz tomorrow',
        ])->assertCreated();

        $announcementId = $create->json('data.id');

        // Student should not see it until published
        Sanctum::actingAs($student);
        $this->getJson('/api/student/announcements')
            ->assertOk()
            ->assertJsonPath('data.data', []);

        // Teacher publishes
        Sanctum::actingAs($teacher);
        $this->postJson("/api/teacher/announcements/{$announcementId}/publish")
            ->assertOk();

        // Student sees it and can mark read
        Sanctum::actingAs($student);
        $list = $this->getJson('/api/student/announcements')->assertOk();
        $this->assertNotEmpty($list->json('data.data'));

        $this->postJson("/api/student/announcements/{$announcementId}/read")
            ->assertOk();
    }

    public function test_admin_can_delete_any_announcement(): void
    {
        $adminRole = Role::query()->create(['name' => 'admin']);
        $teacherRole = Role::query()->create(['name' => 'teacher']);

        $admin = User::factory()->create(['role_id' => $adminRole->id]);
        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-4001']);

        $year = SchoolYear::query()->create([
            'name' => 'SY Ann 2',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'PE',
            'grade_level' => '10',
            'section' => 'E',
        ]);

        $announcement = ClassAnnouncement::query()->create([
            'class_id' => $class->id,
            'created_by' => $teacher->id,
            'title' => 'Note',
            'body' => 'Bring shoes',
            'published_at' => now(),
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/admin/announcements/{$announcement->id}")
            ->assertOk();
    }
}

