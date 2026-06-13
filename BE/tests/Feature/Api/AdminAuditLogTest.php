<?php

namespace Tests\Feature\Api;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminAuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admin_can_view_audit_logs(): void
    {
        $adminRole = Role::query()->create(['name' => 'admin']);
        $studentRole = Role::query()->create(['name' => 'student']);

        $admin = User::factory()->create(['role_id' => $adminRole->id]);
        $student = User::factory()->create(['role_id' => $studentRole->id]);

        AuditLog::query()->create([
            'user_id' => $admin->id,
            'action' => 'test.action',
            'table_name' => 'users',
            'record_id' => $admin->id,
            'description' => 'Test',
        ]);

        Sanctum::actingAs($student);
        $this->getJson('/api/admin/audit-logs')->assertStatus(403);

        Sanctum::actingAs($admin);
        $this->getJson('/api/admin/audit-logs')
            ->assertOk()
            ->assertJsonStructure(['data' => ['data']]);
    }
}

