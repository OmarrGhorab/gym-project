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
// Just after the working day turns over at 05:00, so the summary covers a day
// that is actually finished — including the shifts that ran past midnight, which
// a 23:50 run reported on before their takings existed.
Schedule::command('shifts:send-daily-summary')->dailyAt('05:10')->timezone('Africa/Cairo')->withoutOverlapping();
// Five minutes after the shift summary, so the day it reports on is closed and
// every shift of it has been written.
Schedule::command('reports:send-daily')->dailyAt('05:15')->timezone('Africa/Cairo')->withoutOverlapping();
Schedule::command('exports:prune')->hourly();
// Often enough that nobody spends a morning wondering why members stopped
// getting messages; the command itself waits out transient drops before it
// bothers anyone.
Schedule::command('whatsapp:check-connection')->everyFiveMinutes()->withoutOverlapping();
