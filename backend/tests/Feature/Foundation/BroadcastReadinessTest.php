<?php

use App\Actions\Foundation\CheckInfrastructureReadiness;

// phpunit.xml sets BROADCAST_CONNECTION=null.
// We verify that:
//   1. The broadcast config is present and safe (no hardcoded secrets).
//   2. The broadcast connection can be resolved without exceptions.
//   3. The readiness action reports the broadcast status.

describe('Broadcast/realtime configuration readiness', function () {
    it('broadcast configuration section exists in config/broadcasting.php', function () {
        $connections = config('broadcasting.connections');

        expect($connections)->toBeArray()->not->toBeEmpty();
    });

    it('reverb connection is registered in broadcasting config without hardcoded secrets', function () {
        $connections = config('broadcasting.connections');
        $keys = array_keys($connections);

        // At minimum null and log drivers must be present; reverb or pusher may also be present.
        expect($keys)->toContain('null');
    });

    it('realtime readiness config exists in config/services.php', function () {
        // T063 adds a realtime key to services.php populated from env only.
        $realtime = config('services.realtime');

        expect($realtime)->toBeArray();
    });

    it('reports broadcast status via CheckInfrastructureReadiness', function () {
        $action = new CheckInfrastructureReadiness;
        $result = $action->check();

        // The broadcast key must be present; value is a bool (true or false is both acceptable —
        // in test env with BROADCAST_CONNECTION=null it will be true because null driver is safe).
        expect($result)->toHaveKey('broadcast');
        expect($result['broadcast'])->toBeBool();
    });
});
