<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * A send that the WhatsApp gateway rejected.
 *
 * `retryable` is the whole point of this class: a disconnected number or a full
 * gateway queue is a "come back later", while a number that is not on WhatsApp
 * will never succeed no matter how many times we try. The job retries the first
 * and gives up immediately on the second.
 */
class WhatsAppSendException extends RuntimeException
{
    /**
     * @param  string|null  $gatewayCode  The gateway's machine-readable reason
     *                                    ("not_connected", "queue_full", ...).
     *                                    Not named $code: Exception already
     *                                    declares a non-readonly $code.
     */
    public function __construct(
        string $message,
        public readonly bool $retryable = false,
        public readonly ?string $gatewayCode = null,
    ) {
        parent::__construct($message);
    }

    public static function retryable(string $message, ?string $gatewayCode = null): self
    {
        return new self($message, true, $gatewayCode);
    }

    public static function permanent(string $message, ?string $gatewayCode = null): self
    {
        return new self($message, false, $gatewayCode);
    }
}
