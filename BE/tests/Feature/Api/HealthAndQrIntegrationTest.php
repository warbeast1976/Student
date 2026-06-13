<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HealthAndQrIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_includes_integration_hints(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure([
                'integrations' => [
                    'mail_driver',
                    'mail_sends_real_email',
                    'sms_mode',
                    'sms_sends_real_sms',
                ],
            ]);
    }

    public function test_student_can_fetch_authenticated_qr_png(): void
    {
        $studentRole = Role::query()->create(['name' => 'student']);

        $year = SchoolYear::query()->create([
            'name' => 'SY QR',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $teacher = User::factory()->create();
        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'QR',
            'grade_level' => '10',
            'section' => 'A',
        ]);

        $student = User::factory()->create(['role_id' => $studentRole->id]);
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'class_id' => $class->id,
            'student_number' => 'S-QR-1',
        ]);

        Sanctum::actingAs($student);

        $this->get('/api/student/qr-image?size=180')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png');
    }
}
