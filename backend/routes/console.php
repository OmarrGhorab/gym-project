<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('subscriptions:send-renewal-reminders')->daily();
Schedule::command('subscriptions:enforce-lifecycle')->daily();
Schedule::command('subscriptions:mark-expired')->daily();
Schedule::command('subscriptions:expire')->daily();
Schedule::command('exports:prune')->hourly();
