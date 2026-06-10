<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;

class ProviderHookChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        // External provider integration is intentionally deferred.
        // When configured, this channel becomes the single seam for SMS/WhatsApp.
    }
}
