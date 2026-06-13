<?php

namespace Tests\Feature\Api;

use App\Models\AbsenceAttachment;
use App\Models\AbsenceReport;
use App\Models\AttendanceRecord;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AbsenceWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_submit_absence_report_with_attachment_and_teacher_can_approve(): void
    {
        Storage::fake('public');

        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-2000']);

        $year = SchoolYear::query()->create([
            'name' => 'SY Absence',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'Science',
            'grade_level' => '10',
            'section' => 'B',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-2000',
        ]);

        $attendance = AttendanceRecord::query()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'teacher_id' => $teacher->id,
            'school_year_id' => $year->id,
            'attendance_date' => Carbon::today()->toDateString(),
            'status' => AttendanceRecord::STATUS_ABSENT,
        ]);

        Sanctum::actingAs($student);
        $res = $this->postJson('/api/student/absence-reports', [
            'attendance_record_id' => $attendance->id,
            'reason' => 'Medical',
            'attachments' => [
                UploadedFile::fake()->create('note.pdf', 20, 'application/pdf'),
            ],
        ]);

        $res->assertCreated()->assertJsonStructure(['data' => ['id', 'status', 'attendance_record_id', 'attachments']]);

        $reportId = $res->json('data.id');
        $report = AbsenceReport::query()->findOrFail($reportId);
        $this->assertSame(AbsenceReport::STATUS_PENDING, $report->status);

        $attachment = AbsenceAttachment::query()->where('absence_report_id', $report->id)->firstOrFail();
        Storage::disk('public')->assertExists($attachment->file_path);

        // Teacher approves
        Sanctum::actingAs($teacher);
        $approve = $this->postJson("/api/teacher/absence-reports/{$reportId}/approve", [
            'admin_remarks' => 'Ok',
        ]);

        $approve->assertOk();
        $this->assertDatabaseHas('absence_reports', [
            'id' => $reportId,
            'status' => AbsenceReport::STATUS_APPROVED,
        ]);
    }

    public function test_student_cannot_download_other_students_attachment(): void
    {
        Storage::fake('public');

        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-3000']);

        $year = SchoolYear::query()->create([
            'name' => 'SY Download',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'English',
            'grade_level' => '10',
            'section' => 'C',
        ]);

        $student1 = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create(['user_id' => $student1->id, 'class_id' => $class->id, 'student_number' => 'S-3001']);

        $student2 = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create(['user_id' => $student2->id, 'class_id' => $class->id, 'student_number' => 'S-3002']);

        $attendance = AttendanceRecord::query()->create([
            'student_id' => $student1->id,
            'class_id' => $class->id,
            'teacher_id' => $teacher->id,
            'school_year_id' => $year->id,
            'attendance_date' => Carbon::today()->toDateString(),
            'status' => AttendanceRecord::STATUS_ABSENT,
        ]);

        Sanctum::actingAs($student1);
        $res = $this->postJson('/api/student/absence-reports', [
            'attendance_record_id' => $attendance->id,
            'reason' => 'Reason',
            'attachments' => [
                UploadedFile::fake()->create('proof.png', 5, 'image/png'),
            ],
        ])->assertCreated();

        $attachmentId = $res->json('data.attachments.0.id');

        Sanctum::actingAs($student2);
        $this->get("/api/student/absence-attachments/{$attachmentId}")
            ->assertStatus(403);
    }
}

