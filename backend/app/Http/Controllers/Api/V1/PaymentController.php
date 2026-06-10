<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Payments\RecordPayment;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PaymentController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Payment::class);

        $status = request()->string('status')->toString();

        if ($status === 'due') {
            $dues = Subscription::query()
                ->with(['member', 'plan', 'soldBy'])
                ->withSum('payments', 'amount')
                ->whereRaw('price_paid > COALESCE((select sum(amount) from payments where payments.payable_type = ? and payments.payable_id = subscriptions.id), 0)', [Subscription::class])
                ->orderBy('end_date')
                ->paginate(15)
                ->withQueryString();

            $data = $dues->getCollection()->map(function (Subscription $subscription): array {
                $paid = number_format((float) ($subscription->payments_sum_amount ?? 0), 2, '.', '');
                $balance = bcsub((string) $subscription->price_paid, $paid, 2);

                return [
                    'subscription' => [
                        'id' => $subscription->id,
                        'status' => $subscription->status,
                        'start_date' => $subscription->start_date?->toDateString(),
                        'end_date' => $subscription->end_date?->toDateString(),
                    ],
                    'member' => [
                        'id' => $subscription->member?->id,
                        'name' => $subscription->member?->name,
                    ],
                    'balance' => $balance,
                    'paid_total' => $paid,
                    'price_paid' => $subscription->price_paid,
                ];
            })->values();

            return $this->success(
                data: $data,
                message: 'Dues retrieved',
                meta: [
                    'current_page' => $dues->currentPage(),
                    'per_page' => $dues->perPage(),
                    'total' => $dues->total(),
                    'last_page' => $dues->lastPage(),
                ],
            );
        }

        $payments = Payment::query()
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

    public function store(StorePaymentRequest $request, RecordPayment $action): JsonResponse
    {
        $subscription = Subscription::query()->findOrFail($request->integer('subscription_id'));
        $payment = $action->handle($subscription, $request->validated(), $request->user());

        return (new PaymentResource($payment))
            ->withMessage('Payment recorded')
            ->response()
            ->setStatusCode(201);
    }
}
