<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string', 'max:100'],
            'table_name' => ['nullable', 'string', 'max:100'],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date', 'required_with:to'],
            'to' => ['nullable', 'date', 'required_with:from', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = AuditLog::query()->with(['user.role'])->orderByDesc('id');

        if (! empty($data['user_id'])) {
            $query->where('user_id', (int) $data['user_id']);
        }

        if (! empty($data['action'])) {
            $query->where('action', $data['action']);
        }

        if (! empty($data['table_name'])) {
            $query->where('table_name', $data['table_name']);
        }

        if (! empty($data['from']) && ! empty($data['to'])) {
            $query->whereBetween('created_at', [$data['from'] . ' 00:00:00', $data['to'] . ' 23:59:59']);
        }

        if (! empty($data['search'])) {
            $search = trim((string) $data['search']);
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('table_name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        return response()->json([
            'data' => $query->paginate((int) ($data['per_page'] ?? 30)),
        ]);
    }
}

