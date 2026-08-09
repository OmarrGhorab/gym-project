<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One automatic WhatsApp message: what we tried to send, to whom, and how it went.
 *
 * This is the audit trail behind "did the member actually get their barcode?",
 * and it is also the dedup key — SendMemberMessage refuses to queue a second
 * message for the same subscription and template.
 */
class WhatsAppMessage extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    /**
     * Statuses that block a duplicate send. A failed message stays retryable by
     * a later trigger, since the failure may have been a bad phone number that
     * has since been corrected.
     */
    public const BLOCKING_STATUSES = [self::STATUS_PENDING, self::STATUS_SENT];

    /** Laravel would derive "whats_app_messages" from the class name. */
    protected $table = 'whatsapp_messages';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'member_id',
        'subscription_id',
        'template_key',
        'phone',
        'body',
        'image_url',
        'status',
        'provider_message_id',
        'error',
        'attempts',
        'sent_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'sent_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Member, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    /** @return BelongsTo<Subscription, $this> */
    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
