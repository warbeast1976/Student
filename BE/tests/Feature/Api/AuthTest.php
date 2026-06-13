<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_and_user(): void
    {
        $role = Role::query()->create(['name' => 'student', 'display_name' => 'Student']);
        $user = User::query()->create([
            'role_id' => $role->id,
            'first_name' => 'A',
            'last_name' => 'B',
            'email' => 's@example.com',
            'password' => Hash::make('password'),
            'status' => User::STATUS_ACTIVE,
        ]);

        $res = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $res->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'email', 'role_id', 'first_name', 'last_name', 'full_name'],
            ]);
    }

    public function test_student_can_login_with_student_number(): void
    {
        $teacherRole = Role::query()->create(['name' => 'teacher', 'display_name' => 'Teacher']);
        $studentRole = Role::query()->create(['name' => 'student', 'display_name' => 'Student']);

        $teacher = User::query()->create([
            'role_id' => $teacherRole->id,
            'first_name' => 'Tea',
            'last_name' => 'Cher',
            'email' => 't-auth@example.com',
            'password' => Hash::make('password'),
            'status' => User::STATUS_ACTIVE,
        ]);

        $year = SchoolYear::query()->create([
            'name' => 'SY Auth',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'DemoAuth',
            'grade_level' => '1',
            'section' => 'A',
        ]);

        $user = User::query()->create([
            'role_id' => $studentRole->id,
            'first_name' => 'Pat',
            'last_name' => 'Lee',
            'email' => 'pat@example.com',
            'password' => Hash::make('password'),
            'status' => User::STATUS_ACTIVE,
        ]);

        StudentProfile::query()->create([
            'user_id' => $user->id,
            'class_id' => $class->id,
            'student_number' => 'STU-9001',
        ]);

        $this->postJson('/api/auth/login', [
            'login' => 'STU-9001',
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'email', 'role_id', 'first_name', 'last_name', 'full_name'],
            ]);
    }

    public function test_me_requires_auth(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }

    public function test_teacher_can_patch_own_profile_contact_fields(): void
    {
        $teacherRole = Role::query()->create(['name' => 'teacher', 'display_name' => 'Teacher']);
        $user = User::query()->create([
            'role_id' => $teacherRole->id,
            'first_name' => 'T',
            'last_name' => 'One',
            'email' => 't1@example.com',
            'password' => Hash::make('secret12'),
            'status' => User::STATUS_ACTIVE,
        ]);
        TeacherProfile::query()->create([
            'user_id' => $user->id,
            'employee_id' => 'T-PATCH-1',
            'contact_number' => '111',
            'address' => 'Old',
        ]);

        Sanctum::actingAs($user);

        $this->patchJson('/api/auth/profile', [
            'first_name' => 'Terry',
            'teacher_profile' => [
                'contact_number' => '555-0100',
                'address' => 'New street',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('user.first_name', 'Terry')
            ->assertJsonPath('user.teacher_profile.contact_number', '555-0100')
            ->assertJsonPath('user.teacher_profile.address', 'New street');

        $this->assertSame('Terry', $user->fresh()->first_name);
    }

    public function test_student_can_patch_own_profile_and_requires_current_password_for_password_change(): void
    {
        $teacherRole = Role::query()->create(['name' => 'teacher', 'display_name' => 'Teacher']);
        $studentRole = Role::query()->create(['name' => 'student', 'display_name' => 'Student']);

        $teacher = User::query()->create([
            'role_id' => $teacherRole->id,
            'first_name' => 'Adv',
            'last_name' => 'Iser',
            'email' => 'adv@example.com',
            'password' => Hash::make('password'),
            'status' => User::STATUS_ACTIVE,
        ]);

        $year = SchoolYear::query()->create([
            'name' => 'SY Patch',
            'start_date' => '2025-06-01',
            'end_date' => '2026-03-31',
            'is_active' => true,
        ]);

        $class = SchoolClass::query()->create([
            'school_year_id' => $year->id,
            'teacher_id' => $teacher->id,
            'class_name' => 'PatchClass',
            'grade_level' => '1',
            'section' => 'A',
        ]);

        $user = User::query()->create([
            'role_id' => $studentRole->id,
            'first_name' => 'Sam',
            'last_name' => 'Student',
            'email' => 'sam@example.com',
            'password' => Hash::make('oldpass99'),
            'status' => User::STATUS_ACTIVE,
        ]);

        StudentProfile::query()->create([
            'user_id' => $user->id,
            'class_id' => $class->id,
            'student_number' => 'STU-PATCH-1',
            'guardian_name' => 'Mom',
        ]);

        Sanctum::actingAs($user);

        $this->patchJson('/api/auth/profile', [
            'password' => 'newpass99',
        ])->assertStatus(422);

        $this->patchJson('/api/auth/profile', [
            'current_password' => 'wrong',
            'password' => 'newpass99',
        ])->assertStatus(422);

        $this->patchJson('/api/auth/profile', [
            'current_password' => 'oldpass99',
            'password' => 'newpass99',
            'student_profile' => [
                'guardian_name' => 'Guardian Patched',
                'contact_number' => '555-0199',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('user.student_profile.guardian_name', 'Guardian Patched')
            ->assertJsonPath('user.student_profile.contact_number', '555-0199');

        $this->assertTrue(Hash::check('newpass99', $user->fresh()->password));
    }

    public function test_admin_can_patch_own_name_and_email(): void
    {
        $adminRole = Role::query()->create(['name' => 'admin', 'display_name' => 'Admin']);
        $user = User::query()->create([
            'role_id' => $adminRole->id,
            'first_name' => 'A',
            'last_name' => 'Root',
            'email' => 'root@example.com',
            'password' => Hash::make('password'),
            'status' => User::STATUS_ACTIVE,
        ]);

        Sanctum::actingAs($user);

        $this->patchJson('/api/auth/profile', [
            'first_name' => 'Admin',
            'last_name' => 'Updated',
            'email' => 'admin2@example.com',
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'admin2@example.com')
            ->assertJsonPath('user.full_name', 'Admin Updated');
    }
}
