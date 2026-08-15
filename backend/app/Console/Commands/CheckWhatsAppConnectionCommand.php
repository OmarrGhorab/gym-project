<?php

namespace App\Console\Commands;

use App\Services\OperationalNotifier;
use App\Services\WhatsAppGateway;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Watches the gym's WhatsApp link and tells the admins when it stops sending.
 *
 * The gateway is a separate Node process that cannot reach the database, so the
 * alert has to be pulled rather than pushed — which is just as well, because the
 * failure the gym feels most (the service is down entirely) is the one a push
 * could never report.
 *
 * The point of the notification is not the state name; it is telling whoever is
 * on the desk to send the reminders and barcodes by hand until the number is
 * linked again.
 */
final class CheckWhatsAppConnectionCommand extends Command
{
    protected $signature = 'whatsapp:check-connection';

    protected $description = 'Alert the admins when the gym\'s WhatsApp number stops sending, so staff can message members by hand until it is linked again.';

    private const WATCH_KEY = 'whatsapp.connection.watch';

    /**
     * Dead ends: the session is gone or has been taken over, and it will not
     * come back without someone acting on it. No point waiting out a grace
     * period that cannot change the answer.
     */
    private const TERMINAL_STATES = ['logged_out', 'conflict'];

    /**
     * How long a merely unhealthy connection (a dropped socket, a service being
     * restarted, a code waiting to be scanned) may last before it is worth
     * anyone's attention. The gateway reconnects on its own well inside this.
     */
    private const GRACE_MINUTES = 15;

    /** How long before the same unresolved fault is raised again. */
    private const REPEAT_HOURS = 6;

    public function handle(WhatsAppGateway $gateway, OperationalNotifier $notifier): int
    {
        // A gym that never set WhatsApp up is not broken, and nagging it about
        // an integration it does not use trains everyone to ignore the bell.
        if (! $gateway->configured()) {
            return self::SUCCESS;
        }

        $status = $gateway->status();
        $state = (string) $status['state'];
        $watch = (array) Cache::get(self::WATCH_KEY, []);

        if ($state === 'connected') {
            if (($watch['alerted_state'] ?? null) !== null) {
                $notifier->whatsAppLinkRestored($status['number']);
                $this->info('WhatsApp is connected again.');
            }

            Cache::forget(self::WATCH_KEY);

            return self::SUCCESS;
        }

        $now = Carbon::now();
        $unhealthySince = isset($watch['unhealthy_since'])
            ? Carbon::parse($watch['unhealthy_since'])
            : $now;

        $terminal = in_array($state, self::TERMINAL_STATES, true);
        $waitedOut = $unhealthySince->copy()->addMinutes(self::GRACE_MINUTES)->isPast();

        if (($terminal || $waitedOut) && $this->shouldAlert($watch, $state, $now)) {
            $notifier->whatsAppLinkLost($state, $status['error'], (int) $status['queued']);
            $watch['alerted_state'] = $state;
            $watch['alerted_at'] = $now->toIso8601String();
            $this->warn("WhatsApp is not sending (state: {$state}). Admins notified.");
        }

        $watch['unhealthy_since'] = $unhealthySince->toIso8601String();
        // Long enough to outlive any outage worth alerting on, short enough that
        // a cache that survives one does not suppress the next alert forever.
        Cache::put(self::WATCH_KEY, $watch, $now->copy()->addDays(7));

        return self::SUCCESS;
    }

    /**
     * A fault that is already reported and unchanged is not news every five
     * minutes — but one that changed (reconnecting became unlinked) is, because
     * what the admin has to do about it changed with it.
     *
     * @param  array<string, mixed>  $watch
     */
    private function shouldAlert(array $watch, string $state, Carbon $now): bool
    {
        $alertedState = $watch['alerted_state'] ?? null;

        if ($alertedState === null || $alertedState !== $state) {
            return true;
        }

        return ! isset($watch['alerted_at'])
            || Carbon::parse($watch['alerted_at'])->addHours(self::REPEAT_HOURS)->isPast();
    }
}
