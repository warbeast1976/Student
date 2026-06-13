<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Auth\User as AuthUser;

class AuditLogger
{
    public static function log(?AuthUser $user, string $action, ?Model $model = null, ?string $description = null): void
    {
        if (! $user) {
            return;
        }

        AuditLog::create([
            'user_id' => $user->getAuthIdentifier(),
            'action' => $action,
            'table_name' => $model?->getTable(),
            'record_id' => $model?->getKey(),
            'description' => $description,
        ]);
    }
}

