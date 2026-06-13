<?php

namespace Tests\Feature\Api;

use App\Models\ClassAnnouncement;
use App\Models\ClassAnnouncementComment;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AnnouncementCommentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_comment_on_published_announcement_and_teacher_can_hide(): void
    {
        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-5000']);

        $year = SchoolYear::query()->create([
            'name' => 'SY C',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'Geo',
            'grade_level' => '10',
            'section' => 'F',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-5000',
        ]);

        $announcement = ClassAnnouncement::query()->create([
            'class_id' => $class->id,
            'created_by' => $teacher->id,
            'title' => 'Hello',
            'body' => 'World',
            'published_at' => now(),
        ]);

        Sanctum::actingAs($student);
        $create = $this->postJson("/api/student/announcements/{$announcement->id}/comments", [
            'body' => 'Question?',
        ])->assertCreated();

        $commentId = $create->json('data.id');

        Sanctum::actingAs($teacher);
        $this->postJson("/api/teacher/announcement-comments/{$commentId}/hide")
            ->assertOk();

        Sanctum::actingAs($student);
        $list = $this->getJson("/api/student/announcements/{$announcement->id}/comments")
            ->assertOk();

        // hidden comments should not appear in student list
        $this->assertSame([], $list->json('data.data'));
    }
}

