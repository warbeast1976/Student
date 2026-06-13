<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserImportExportController extends Controller
{
    public function export(Request $request)
    {
        $role = $request->query('role'); // admin|teacher|student

        $query = User::query()->with(['role', 'studentProfile', 'teacherProfile'])->orderBy('id');
        if ($role) {
            $query->whereHas('role', fn ($q) => $q->where('name', $role));
        }

        $filename = 'users_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'role',
                'email',
                'first_name',
                'last_name',
                'status',
                'student_number',
                'class_id',
                'employee_id',
                'contact_number',
            ]);

            $query->chunk(500, function ($users) use ($out) {
                foreach ($users as $u) {
                    fputcsv($out, [
                        $u->role?->name,
                        $u->email,
                        $u->first_name,
                        $u->last_name,
                        $u->status,
                        $u->studentProfile?->student_number,
                        $u->studentProfile?->class_id,
                        $u->teacherProfile?->employee_id,
                        $u->studentProfile?->contact_number ?? $u->teacherProfile?->contact_number,
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function import(Request $request)
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:20480'],
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        if (! $handle) {
            return response()->json(['message' => 'Unable to read file.'], 422);
        }

        $header = fgetcsv($handle);
        if (! $header) {
            return response()->json(['message' => 'CSV header missing.'], 422);
        }

        $expected = ['role', 'email', 'first_name', 'last_name', 'password', 'status'];
        foreach ($expected as $col) {
            if (! in_array($col, $header, true)) {
                return response()->json(['message' => "Missing column: {$col}"], 422);
            }
        }

        $idx = array_flip($header);
        $roles = Role::query()->pluck('id', 'name')->all();

        $created = 0;
        $updated = 0;
        $errors = [];
        $rowNum = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNum++;
            $get = fn (string $k) => $row[$idx[$k]] ?? null;

            $roleName = strtolower(trim((string) $get('role')));
            $email = strtolower(trim((string) $get('email')));
            $first = trim((string) $get('first_name'));
            $last = trim((string) $get('last_name'));
            $password = (string) $get('password');
            $status = trim((string) $get('status')) ?: User::STATUS_ACTIVE;

            if (! isset($roles[$roleName])) {
                $errors[] = ['row' => $rowNum, 'error' => "Invalid role '{$roleName}'"];
                continue;
            }
            if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = ['row' => $rowNum, 'error' => "Invalid email '{$email}'"];
                continue;
            }
            if ($first === '' || $last === '' || $password === '') {
                $errors[] = ['row' => $rowNum, 'error' => 'first_name/last_name/password required'];
                continue;
            }
            if (! in_array($status, [User::STATUS_ACTIVE, User::STATUS_INACTIVE], true)) {
                $errors[] = ['row' => $rowNum, 'error' => "Invalid status '{$status}'"];
                continue;
            }

            // Optional columns
            $studentNumber = $idx['student_number'] ?? null;
            $classId = $idx['class_id'] ?? null;
            $employeeId = $idx['employee_id'] ?? null;
            $contactNumber = $idx['contact_number'] ?? null;

            $studentNumberVal = $studentNumber !== null ? trim((string) ($row[$studentNumber] ?? '')) : '';
            $classIdVal = $classId !== null ? (int) ($row[$classId] ?? 0) : 0;
            $employeeIdVal = $employeeId !== null ? trim((string) ($row[$employeeId] ?? '')) : '';
            $contactNumberVal = $contactNumber !== null ? trim((string) ($row[$contactNumber] ?? '')) : null;

            try {
                DB::transaction(function () use (
                    $email,
                    $roles,
                    $roleName,
                    $first,
                    $last,
                    $password,
                    $status,
                    $studentNumberVal,
                    $classIdVal,
                    $employeeIdVal,
                    $contactNumberVal,
                    &$created,
                    &$updated
                ) {
                    $user = User::query()->where('email', $email)->first();
                    if (! $user) {
                        $user = User::create([
                            'role_id' => $roles[$roleName],
                            'first_name' => $first,
                            'last_name' => $last,
                            'email' => $email,
                            'password' => Hash::make($password),
                            'status' => $status,
                        ]);
                        $created++;
                    } else {
                        $user->role_id = $roles[$roleName];
                        $user->first_name = $first;
                        $user->last_name = $last;
                        $user->password = Hash::make($password);
                        $user->status = $status;
                        $user->save();
                        $updated++;
                    }

                    if ($roleName === 'student') {
                        if ($studentNumberVal !== '' && $classIdVal > 0) {
                            StudentProfile::query()->updateOrCreate(
                                ['user_id' => $user->id],
                                [
                                    'class_id' => $classIdVal,
                                    'student_number' => $studentNumberVal,
                                    'contact_number' => $contactNumberVal,
                                ]
                            );
                        }
                    } else {
                        $user->studentProfile()?->delete();
                    }

                    if ($roleName === 'teacher') {
                        if ($employeeIdVal !== '') {
                            TeacherProfile::query()->updateOrCreate(
                                ['user_id' => $user->id],
                                [
                                    'employee_id' => $employeeIdVal,
                                    'contact_number' => $contactNumberVal,
                                ]
                            );
                        }
                    } else {
                        $user->teacherProfile()?->delete();
                    }
                });
            } catch (\Throwable $e) {
                $errors[] = ['row' => $rowNum, 'error' => $e->getMessage()];
            }
        }

        fclose($handle);

        AuditLogger::log($request->user(), 'users.import', null, "Imported users: created={$created}, updated={$updated}");

        return response()->json([
            'created' => $created,
            'updated' => $updated,
            'errors' => $errors,
        ]);
    }
}

