<?php

namespace Tests\Feature\Api;

use App\Models\AbsenceReport;
use App\Models\AttendanceRecord;
use App\Models\ClassAnnouncement;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Notifications\AttendanceMarkedAbsent;
use App\Notifications\AbsenceReportReviewed;
use App\Notifications\AnnouncementPublished;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_publishing_announcement_notifies_students(): void
    {
        Notification::fake();

        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-6000']);

        $year = SchoolYear::query()->create([
            'name' => 'SY N',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'Notif',
            'grade_level' => '10',
            'section' => 'G',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-6000',
            'contact_number' => '09123456789',
        ]);

        $announcement = ClassAnnouncement::query()->create([
            'class_id' => $class->id,
            'created_by' => $teacher->id,
            'title' => 'A',
            'body' => 'B',
            'published_at' => null,
        ]);

        Sanctum::actingAs($teacher);
        $this->postJson("/api/teacher/announcements/{$announcement->id}/publish")
            ->assertOk();

        Notification::assertSentTo($student, AnnouncementPublished::class);
    }

    public function test_reviewing_absence_report_notifies_student(): void
    {
        Notification::fake();

        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-6001']);

        $year = SchoolYear::query()->create([
            'name' => 'SY N2',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'Abs',
            'grade_level' => '10',
            'section' => 'H',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-6001',
            'contact_number' => '09999999999',
        ]);

        $attendance = AttendanceRecord::query()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'teacher_id' => $teacher->id,
            'school_year_id' => $year->id,
            'attendance_date' => Carbon::today()->toDateString(),
            'status' => AttendanceRecord::STATUS_ABSENT,
        ]);

        $report = AbsenceReport::query()->create([
            'attendance_record_id' => $attendance->id,
            'student_id' => $student->id,
            'class_id' => $class->id,
            'submitted_by' => $student->id,
            'reason' => 'R',
            'status' => AbsenceReport::STATUS_PENDING,
        ]);

        Sanctum::actingAs($teacher);
        $this->postJson("/api/teacher/absence-reports/{$report->id}/approve")
            ->assertOk();

        Notification::assertSentTo($student, AbsenceReportReviewed::class);
    }

    public function test_marking_attendance_absent_notifies_student(): void
    {
        Notification::fake();

        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-7001']);

        $year = SchoolYear::query()->create([
            'name' => 'SY N3',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'Alert',
            'grade_level' => '10',
            'section' => 'I',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-7001',
            'contact_number' => '09123456789',
        ]);

        Sanctum::actingAs($teacher);
        $this->postJson('/api/teacher/attendance/mark', [
            'class_id' => $class->id,
            'school_year_id' => $year->id,
            'attendance_date' => Carbon::today()->toDateString(),
            'records' => [
                [
                    'student_id' => $student->id,
                    'status' => AttendanceRecord::STATUS_ABSENT,
                ],
            ],
        ])->assertCreated();

        Notification::assertSentTo($student, AttendanceMarkedAbsent::class);
    }
}

