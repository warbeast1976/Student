<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImportExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_export_users_csv(): void
    {
        $adminRole = Role::query()->create(['name' => 'admin']);
        Role::query()->create(['name' => 'student']);
        $admin = User::query()->create([
            'role_id' => $adminRole->id,
            'first_name' => 'A',
            'last_name' => 'B',
            'email' => 'a@b.com',
            'password' => Hash::make('password'),
            'status' => User::STATUS_ACTIVE,
        ]);

        Sanctum::actingAs($admin);
        $res = $this->get('/api/admin/users-export');
        $res->assertOk();
        $this->assertStringContainsString('text/csv', (string) $res->headers->get('content-type'));
    }

    public function test_admin_can_import_users_csv(): void
    {
        $adminRole = Role::query()->create(['name' => 'admin']);
        Role::query()->create(['name' => 'student']);
        $admin = User::query()->create([
            'role_id' => $adminRole->id,
            'first_name' => 'A',
            'last_name' => 'B',
            'email' => 'admin@ex.com',
            'password' => Hash::make('password'),
            'status' => User::STATUS_ACTIVE,
        ]);

        $csv = implode("\n", [
            'role,email,first_name,last_name,password,status',
            'student,newstudent@example.com,New,Student,password,active',
        ]);

        $file = UploadedFile::fake()->createWithContent('users.csv', $csv);

        Sanctum::actingAs($admin);
        $this->postJson('/api/admin/users-import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('created', 1);

        $this->assertDatabaseHas('users', ['email' => 'newstudent@example.com']);
    }
}

