<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Payments\ListPaymentDues;
use App\Actions\Payments\RecordPayment;
use App\Http\Requests\Payments\IndexPaymentRequest;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;

class PaymentController extends ApiController
{
    public function index(IndexPaymentRequest $request): JsonResponse
    {
        $status = $request->string('status')->toString();

        $payments = Payment::query()
            ->when(
                in_array($status, ['paid', 'partial'], true),
                fn ($query) => $query->where('status', $status),
            )
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: PaymentResource::collection($payments->getCollection())->resolve(),
            message: 'Payments retrieved',
            meta: [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        );
    }

    public function dues(\Illuminate\Http\Request $request): JsonResponse
    {
        $this->authorize('viewAny', Payment::class);

        $perPage = $request->integer('per_page', 50);
        $result = app(ListPaymentDues::class)->handle($perPage > 0 ? $perPage : 50);

        return $this->success(
            data: $result['data'],
            message: 'Dues retrieved',
            meta: $result['meta'],
        );
    }

    public function store(StorePaymentRequest $request, RecordPayment $action): JsonResponse
    {
        $subscription = Subscription::query()->findOrFail($request->integer('subscription_id'));

        $this->authorize('view', $subscription);

        $payment = $action->handle($subscription, $request->validated(), $request->user());

        return (new PaymentResource($payment))
            ->withMessage('Payment recorded')
            ->response()
            ->setStatusCode(201);
    }
}
