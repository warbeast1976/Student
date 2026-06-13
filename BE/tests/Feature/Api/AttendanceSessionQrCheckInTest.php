<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceRecord;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AttendanceSessionQrCheckInTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_open_session_and_student_can_check_in(): void
    {
        $adminRole = Role::query()->create(['name' => 'admin']);
        $teacherRole = Role::query()->create(['name' => 'teacher']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $teacher = User::factory()->create(['role_id' => $teacherRole->id]);
        TeacherProfile::query()->create(['user_id' => $teacher->id, 'employee_id' => 'T-1000']);

        $year = SchoolYear::query()->create([
            'name' => 'SY Test',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'Math',
            'grade_level' => '10',
            'section' => 'A',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-1000',
        ]);

        Sanctum::actingAs($teacher);
        $open = $this->postJson('/api/teacher/attendance-sessions', [
            'class_id' => $class->id,
            'school_year_id' => $year->id,
            'attendance_date' => Carbon::today()->toDateString(),
            'duration_minutes' => 15,
        ]);

        $open->assertCreated()->assertJsonStructure(['data' => ['id'], 'qr_payload']);
        $sessionId = $open->json('data.id');
        $qrPayload = $open->json('qr_payload');

        // Teacher can fetch QR image
        $this->get("/api/teacher/attendance-sessions/{$sessionId}/qr?format=svg")
            ->assertOk()
            ->assertHeader('Content-Type', 'image/svg+xml');

        // Student check-in
        Sanctum::actingAs($student);
        $checkIn = $this->postJson('/api/student/attendance-sessions/check-in', [
            'qr_payload' => $qrPayload,
        ]);

        $checkIn->assertCreated();

        $this->assertDatabaseHas('attendance_records', [
            'student_id' => $student->id,
            'class_id' => $class->id,
            'teacher_id' => $teacher->id,
        ]);

        $record = AttendanceRecord::query()
            ->where('student_id', $student->id)
            ->where('class_id', $class->id)
            ->firstOrFail();

        $this->assertContains($record->status, [
            AttendanceRecord::STATUS_PRESENT,
            AttendanceRecord::STATUS_LATE,
        ]);
    }
}

