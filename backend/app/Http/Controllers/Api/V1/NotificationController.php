<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Notifications\IndexNotificationRequest;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends ApiController
{
    public function index(IndexNotificationRequest $request): JsonResponse
    {
        $notifications = $request->user()
            ->notifications()
            ->when(
                $request->boolean('unread'),
                fn ($query) => $query->whereNull('read_at'),
            )
            ->latest()
            ->paginate(15)
            ->withQueryString();

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
}
