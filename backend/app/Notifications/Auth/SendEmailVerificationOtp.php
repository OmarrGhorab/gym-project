<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sends a one-time password (OTP) that the recipient can use to verify
 * their email address after registration.
 */
class SendEmailVerificationOtp extends Notification
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
            ->subject('Verify your email')
            ->greeting('Hello,')
            ->line('Your email verification code is: **'.$this->otp.'**')
            ->line('This code will expire in 15 minutes.');
    }
}
