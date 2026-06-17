<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sends a one-time password (OTP) that the recipient can use to verify
 * ownership of their email address before resetting their password.
 */
class SendPasswordResetOtp extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $otp,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Password reset code')
            ->greeting('Hello,')
            ->line('Your password reset code is: **'.$this->otp.'**')
            ->line('This code will expire in 15 minutes.');
    }
}
