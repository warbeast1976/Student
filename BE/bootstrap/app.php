<?php

use App\Http\Middleware\AddApiSecurityHeaders;
use App\Http\Middleware\EnsureApiKeyHeader;
use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $trusted = env('TRUSTED_PROXIES');
        if ($trusted === '*') {
            $middleware->trustProxies(at: '*');
        } elseif (is_string($trusted) && $trusted !== '') {
            $middleware->trustProxies(at: array_values(array_filter(array_map('trim', explode(',', $trusted)))));
        }

        $middleware->append(HandleCors::class);

        $middleware->api(append: [
            AddApiSecurityHeaders::class,
        ]);

        // API-only app: no web `login` route. Without this, unauthenticated requests
        // call `route('login')` and throw 500 instead of 401 JSON.
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
            'x-api-key' => EnsureApiKeyHeader::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'errors' => $e->errors(),
                ], 422);
            }

            if ($e instanceof QueryException && ! config('app.debug')) {
                return response()->json(['message' => 'Server error.'], 500);
            }

            $status = 500;
            $payload = ['message' => 'Server error.'];

            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $payload['message'] = $e->getMessage() ?: $payload['message'];
            }

            if ($e instanceof AuthenticationException) {
                $status = 401;
                $payload['message'] = 'Unauthenticated.';
            }

            if ($e instanceof AuthorizationException) {
                $status = 403;
                $payload['message'] = 'Forbidden.';
            }

            if (! config('app.debug') && $status >= 500) {
                $payload['message'] = 'Server error.';
            }

            if (config('app.debug')) {
                $payload['exception'] = $e::class;
                $payload['file'] = $e->getFile();
                $payload['line'] = $e->getLine();
            }

            return response()->json($payload, $status);
        });
    })->create();
