<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Notifications\IndexNotificationRequest;
use App\Http\Resources\NotificationResource;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Support\SubscriptionMessagePayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class NotificationController extends ApiController
{
    public function index(IndexNotificationRequest $request): JsonResponse
    {
        $status = $request->validated('status');

        $notifications = $request->user()
            ->notifications()
            ->when(
                $request->boolean('unread') || $status === 'unread',
                fn ($query) => $query->whereNull('read_at'),
            )
            ->when(
                $status === 'read',
                fn ($query) => $query->whereNotNull('read_at'),
            )
            ->when(
                $request->validated('category'),
                fn ($query, string $category) => $query->where('data->category', $category),
            )
            ->latest()
            ->paginate((int) ($request->validated('per_page') ?? 15))
            ->withQueryString();

        $this->refreshSubscriptionPayloads($notifications->getCollection());
        $this->refreshFreezeApprovalPayloads($notifications->getCollection());

        return $this->success(
            data: NotificationResource::collection($notifications->getCollection())->resolve(),
            message: 'Notifications retrieved',
            meta: [
                'current_page' => $notifications->currentPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
                'last_page' => $notifications->lastPage(),
            ],
        );
    }

    /**
     * Fill in the WhatsApp message fields for subscription notifications.
     *
     * A notification's payload is frozen when it is written, so rows created
     * before those fields existed render blank placeholders in the message, and
     * an attendance code stored back then no longer matches the member's badge
     * once codes are regenerated. Resolving at read time fixes both, and keeps
     * working the next time codes change.
     *
     * Stored values win where present, so a historical notification keeps the
     * dates it was sent with; only the barcode is always taken from the member,
     * because a stale one hands out a barcode that will not scan.
     *
     * @param  \Illuminate\Support\Collection<int, \Illuminate\Notifications\DatabaseNotification>  $notifications
     */
    private function refreshSubscriptionPayloads(Collection $notifications): void
    {
        $subscriptionIds = $notifications
            ->pluck('data.subscription_id')
            ->filter()
            ->unique();

        if ($subscriptionIds->isEmpty()) {
            return;
        }

        // One query for the whole page rather than one per notification.
        $subscriptions = Subscription::query()
            ->with(SubscriptionMessagePayload::RELATIONS)
            ->whereKey($subscriptionIds)
            ->get()
            ->keyBy('id');

        foreach ($notifications as $notification) {
            $subscription = $subscriptions->get($notification->data['subscription_id'] ?? null);

            if ($subscription === null) {
                continue;
            }

            $fresh = SubscriptionMessagePayload::for($subscription);
            $stored = $notification->data;

            // In-memory only — these are never saved back to the notification row.
            $notification->data = [
                ...$fresh,
                ...$stored,
                'attendance_code' => $fresh['attendance_code'],
                'attendance_qr' => $fresh['attendance_qr'],
            ];
        }
    }

    /**
     * Approval notifications are actionable, so their stored snapshot must not
     * keep showing Approve/Dismiss after another manager has made the decision.
     *
     * @param  Collection<int, \Illuminate\Notifications\DatabaseNotification>  $notifications
     */
    private function refreshFreezeApprovalPayloads(Collection $notifications): void
    {
        $freezeIds = $notifications
            ->pluck('data.freeze_request_id')
            ->filter()
            ->unique();

        if ($freezeIds->isEmpty()) {
            return;
        }

        $freezes = SubscriptionFreeze::query()
            ->whereKey($freezeIds)
            ->get()
            ->keyBy('id');

        foreach ($notifications as $notification) {
            $freeze = $freezes->get($notification->data['freeze_request_id'] ?? null);

            if ($freeze === null) {
                continue;
            }

            $notification->data = [
                ...$notification->data,
                'approval_status' => $freeze->approval_status,
                'requires_action' => $freeze->isPendingApproval(),
                'approved_at' => $freeze->approved_at?->toIso8601String(),
                'dismissed_at' => $freeze->dismissed_at?->toIso8601String(),
            ];
        }
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $record = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();

        $record->markAsRead();

        return $this->success(
            data: (new NotificationResource($record->fresh()))->resolve(),
            message: 'Notification marked as read',
        );
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $updated = $request->user()
            ->unreadNotifications()
            ->update(['read_at' => now()]);

        return $this->success(
            data: ['updated' => $updated],
            message: 'Notifications marked as read',
        );
    }
}
