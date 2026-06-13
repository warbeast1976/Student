<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * @param  array<int, string>  ...$roles
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $roleName = $user->role?->name;
        if (! $roleName || ! in_array($roleName, $roles, true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}

