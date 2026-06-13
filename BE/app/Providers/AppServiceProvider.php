<?php

namespace App\Providers;

use App\Services\LogSmsSender;
use App\Services\SmsSender;
use App\Services\TwilioSmsSender;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Twilio\Rest\Client;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SmsSender::class, function () {
            $sid = config('services.twilio.sid');
            $token = config('services.twilio.token');
            $from = config('services.twilio.from');

            if (is_string($sid) && $sid !== '' && is_string($token) && $token !== '' && is_string($from) && $from !== '') {
                return new TwilioSmsSender(new Client($sid, $token), $from);
            }

            return new LogSmsSender;
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        $perMinute = max(1, min(1000, (int) env('API_RATE_LIMIT_PER_MINUTE', 120)));
        RateLimiter::for('api', function (Request $request) use ($perMinute) {
            $key = optional($request->user())->getAuthIdentifier() ?: $request->ip();

            return Limit::perMinute($perMinute)->by($key);
        });

        $loginLimit = max(1, min(60, (int) env('LOGIN_RATE_LIMIT_PER_MINUTE', 10)));
        RateLimiter::for('login', function (Request $request) use ($loginLimit) {
            $email = (string) $request->input('email', '');
            $login = (string) $request->input('login', '');

            return Limit::perMinute($loginLimit)->by(strtolower($email !== '' ? $email : $login).'|'.$request->ip());
        });
    }
}
