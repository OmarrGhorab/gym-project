<?php

namespace App\Http\Controllers\Api\V1;

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
        $this->authorize('viewAny', Payment::class);

        $status = $request->string('status')->toString();

        if ($status === 'due') {
            $paidTotals = Payment::query()
                ->selectRaw('payable_id, SUM(amount) as paid_total')
                ->where('payable_type', Subscription::class)
                ->groupBy('payable_id');

            $dues = Subscription::query()
                ->with(['member', 'plan', 'soldBy'])
                ->leftJoinSub($paidTotals, 'paid_totals', 'paid_totals.payable_id', '=', 'subscriptions.id')
                ->select('subscriptions.*')
                ->selectRaw('COALESCE(paid_totals.paid_total, 0) as paid_total')
                ->whereRaw('subscriptions.price_paid > COALESCE(paid_totals.paid_total, 0)')
                ->orderBy('end_date')
                ->paginate(15)
                ->withQueryString();

            $data = $dues->getCollection()->map(function (Subscription $subscription): array {
                $paid = bcadd((string) ($subscription->paid_total ?? '0.00'), '0.00', 2);
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

    public function store(StorePaymentRequest $request, RecordPayment $action): JsonResponse
    {
        $subscription = Subscription::query()->findOrFail($request->integer('subscription_id'));

        if (! $request->user()->can('view', $subscription)) {
            return $this->error(
                code: 'forbidden',
                message: 'You do not have permission to perform this action.',
                details: (object) [],
                status: 403,
            );
        }

        $payment = $action->handle($subscription, $request->validated(), $request->user());

        return (new PaymentResource($payment))
            ->withMessage('Payment recorded')
            ->response()
            ->setStatusCode(201);
    }
}
