<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $adminRole = Role::query()->firstOrCreate(
            ['name' => 'admin'],
            ['display_name' => 'Admin']
        );
        Role::query()->firstOrCreate(
            ['name' => 'teacher'],
            ['display_name' => 'Teacher']
        );
        Role::query()->firstOrCreate(
            ['name' => 'student'],
            ['display_name' => 'Student']
        );

        User::query()->updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'role_id' => $adminRole->id,
                'first_name' => 'System',
                'last_name' => 'Admin',
                'password' => Hash::make('password'),
                'status' => User::STATUS_ACTIVE,
            ]
        );

        $this->call(AcademicStructureSeeder::class);
    }
}
