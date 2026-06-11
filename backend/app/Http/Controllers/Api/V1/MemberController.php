<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Members\DeactivateMember;
use App\Actions\Members\StoreMember;
use App\Actions\Members\StoreMemberPhoto;
use App\Actions\Members\UpdateMember;
use App\Http\Requests\Members\StoreMemberRequest;
use App\Http\Requests\Members\UpdateMemberRequest;
use App\Http\Requests\Members\UploadMemberPhotoRequest;
use App\Http\Resources\MemberResource;
use App\Http\Resources\PaymentResource;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

final class MemberController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Member::class);

        $members = QueryBuilder::for($this->memberQueryWithTotalPaid())
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::callback('search', function ($query, string $value): void {
                    $value = trim($value);

                    $query->where(function ($q) use ($value): void {
                        $q->where('name', 'like', "{$value}%")
                            ->orWhere('phone', 'like', "{$value}%")
                            ->orWhere('phone', 'like', '+'.$value.'%');
                    });
                }),
            )
            ->allowedSorts(
                AllowedSort::field('name'),
                AllowedSort::field('join_date'),
                AllowedSort::field('status'),
                AllowedSort::field('created_at'),
            )
            ->defaultSort('-created_at')
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: MemberResource::collection($members->getCollection())->resolve(),
            message: 'Members retrieved',
            meta: [
                'current_page' => $members->currentPage(),
                'per_page' => $members->perPage(),
                'total' => $members->total(),
                'last_page' => $members->lastPage(),
            ],
        );
    }

    public function store(StoreMemberRequest $request, StoreMember $action): JsonResponse
    {
        $member = $action->handle($request->validated(), $request->user());

        return (new MemberResource($member))
            ->withMessage('Member created')
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Member $member): JsonResponse
    {
        $this->authorize('view', $member);

        $member = $this->memberQueryWithTotalPaid()
            ->whereKey($member->id)
            ->firstOrFail();

        return (new MemberResource($member))
            ->withMessage('Member retrieved')
            ->response()
            ->setStatusCode(200);
    }

    public function update(UpdateMemberRequest $request, Member $member, UpdateMember $action): JsonResponse
    {
        $member = $action->handle($member, $request->validated());

        return (new MemberResource($member))
            ->withMessage('Member updated')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Request $request, Member $member, DeactivateMember $action): JsonResponse
    {
        $this->authorize('delete', $member);

        $member = $action->handle($member);

        return (new MemberResource($member))
            ->withMessage('Member deactivated')
            ->response()
            ->setStatusCode(200);
    }

    public function uploadPhoto(UploadMemberPhotoRequest $request, Member $member, StoreMemberPhoto $action): JsonResponse
    {
        $member = $action->handle($member, $request->file('photo'));

        return (new MemberResource($member))
            ->withMessage('Photo uploaded')
            ->response()
            ->setStatusCode(200);
    }

    public function streamPhoto(Request $request, Member $member): Response
    {
        $this->authorize('view', $member);

        if (! $member->photo_path || ! Storage::disk('local')->exists($member->photo_path)) {
            abort(404, 'No photo found for this member.');
        }

        $content = Storage::disk('local')->get($member->photo_path);
        $mime = Storage::disk('local')->mimeType($member->photo_path);

        return response($content, 200, [
            'Content-Type' => $mime ?: 'application/octet-stream',
            'Content-Disposition' => 'inline',
        ]);
    }

    public function payments(Request $request, Member $member): JsonResponse
    {
        if (! $request->user()->can('view', $member) || ! $request->user()->can('viewAny', Payment::class)) {
            return $this->error(
                code: 'forbidden',
                message: 'You do not have permission to perform this action.',
                details: (object) [],
                status: 403,
            );
        }

        $payments = Payment::query()
            ->whereHasMorph(
                'payable',
                [Subscription::class],
                fn ($query) => $query->where('member_id', $member->id),
            )
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: PaymentResource::collection($payments->getCollection())->resolve(),
            message: 'Member payments retrieved',
            meta: [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        );
    }

    private function memberQueryWithTotalPaid()
    {
        return Member::query()
            ->select('members.*')
            ->selectSub(
                Payment::query()
                    ->selectRaw('COALESCE(SUM(payments.amount), 0)')
                    ->join('subscriptions', function ($join): void {
                        $join->on('subscriptions.id', '=', 'payments.payable_id')
                            ->where('payments.payable_type', '=', Subscription::class);
                    })
                    ->whereColumn('subscriptions.member_id', 'members.id'),
                'total_paid',
            );
    }
}
