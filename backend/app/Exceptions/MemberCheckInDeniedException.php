<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Validation\ValidationException;

/**
 * A check-in the membership rules refused.
 *
 * Carries the same reason a plain validation failure would, plus a snapshot of
 * the membership it was judged against: the desk is told the scan failed *and*
 * shown the plan, its dates and what is left on it, so the operator can answer
 * the member standing in front of them without opening another screen.
 */
final class MemberCheckInDeniedException extends Exception
{
    /**
     * @param  array<string, mixed>  $membership  Snapshot from SummarizeMemberMembership.
     * @param  string  $field  The field the reason is reported under, kept so the
     *                         error details read exactly as the validation error
     *                         this replaces.
     */
    public function __construct(
        public readonly string $reason,
        public readonly array $membership,
        public readonly string $field = 'member_id',
    ) {
        parent::__construct($reason);
    }

    /**
     * Restate a membership refusal with the membership attached, keeping the
     * original reason and the field it was reported under so the error body reads
     * exactly as the validation failure it replaces.
     *
     * @param  array<string, mixed>  $membership
     */
    public static function from(ValidationException $exception, array $membership): self
    {
        $errors = $exception->errors();
        $field = (string) (array_key_first($errors) ?? 'member_id');
        $reason = (string) (($errors[$field][0] ?? null) ?: $exception->getMessage());

        return new self($reason, $membership, $field);
    }
}
