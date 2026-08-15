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
Schedule::command('member-visits:auto-close')->everyTenMinutes();
// Late enough that the day's check-outs and desk hand-overs are in, early enough
// to still belong to the same day.
Schedule::command('attendance:send-daily-report')->dailyAt('23:55')->timezone('Africa/Cairo')->withoutOverlapping();
Schedule::command('shifts:send-daily-summary')->dailyAt('23:50')->timezone('Africa/Cairo')->withoutOverlapping();
Schedule::command('exports:prune')->hourly();
// Often enough that nobody spends a morning wondering why members stopped
// getting messages; the command itself waits out transient drops before it
// bothers anyone.
Schedule::command('whatsapp:check-connection')->everyFiveMinutes()->withoutOverlapping();
