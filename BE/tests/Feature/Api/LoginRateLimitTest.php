<?php

namespace Tests\Feature\Api;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LoginRateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_is_rate_limited(): void
    {
        $role = Role::query()->create(['name' => 'student']);
        $user = User::query()->create([
            'role_id' => $role->id,
            'first_name' => 'Rate',
            'last_name' => 'Limit',
            'email' => 'ratelimit@example.com',
            'password' => Hash::make('password'),
            'status' => User::STATUS_ACTIVE,
        ]);

        // limiter is 10/min; do 11 attempts quickly
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => $user->email,
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertStatus(429);
    }
}

