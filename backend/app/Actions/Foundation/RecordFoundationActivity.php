<?php

namespace App\Actions\Foundation;

use App\Models\User;

/**
 * Records a foundation-level audit event in the activity log.
 *
 * Why a dedicated Action instead of calling activity() helper directly?
 * - Keeps the audit contract in one place: log name, description format,
 *   and the explicit exclusion of sensitive properties.
 * - Controllers stay thin; they call this action instead of knowing how
 *   activity logging works.
 * - Callable from controllers, jobs, and tests identically.
 *
 * Properties stored: event name and actor ID.
 * Properties excluded: password, token, remember_token (FR-014, Constitution V).
 */
final class RecordFoundationActivity
{
    /**
     * Log a foundation event caused by the given user.
     *
     * @param  array<string, mixed>  $properties  Safe, non-sensitive context to attach.
     */
    public function handle(
        User $causer,
        string $event,
        string $description,
        array $properties = [],
    ): void {
        // Ensure no sensitive keys slip through even if the caller passes them.
        $safeProperties = $this->stripSensitiveKeys($properties);

        activity('foundation')
            ->causedBy($causer)
            ->withProperties($safeProperties)
            ->event($event)
            ->log($description);
    }

    /**
     * Remove any keys that should never appear in the audit log.
     *
     * This is a defence-in-depth measure; callers are responsible for not
     * passing sensitive data, but we strip known dangerous keys here too.
     *
     * @param  array<string, mixed>  $properties
     * @return array<string, mixed>
     */
    private function stripSensitiveKeys(array $properties): array
    {
        $blocklist = ['password', 'token', 'remember_token', 'secret', 'api_key'];

        return array_diff_key($properties, array_flip($blocklist));
    }
}
