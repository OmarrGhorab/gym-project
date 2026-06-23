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
use App\Models\Sale;
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

        $members = QueryBuilder::for(Member::withTotalPaid()->with(['latestSubscription.plan']))
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('gender'),
                AllowedFilter::callback('search', function ($query, string $value): void {
                    $value = trim($value);

                    $query->where(function ($q) use ($value): void {
                        $q->where('name', 'like', "{$value}%")
                            ->orWhere('phone', 'like', "{$value}%")
                            ->orWhere('phone', 'like', '+'.$value.'%');
                    });
                }),
                AllowedFilter::callback('plan_id', function ($query, $value): void {
                    $query->whereHas('subscriptions', function ($q) use ($value): void {
                        $q->where('plan_id', $value);
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

        $member = Member::withTotalPaid()
            ->with(['latestSubscription.plan'])
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
        $mime = Storage::disk('local')->mimeType($member->photo_path) ?: 'application/octet-stream';
        $disposition = str_starts_with($mime, 'image/') ? 'inline' : 'attachment';

        return response($content, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition,
        ]);
    }

    public function payments(Request $request, Member $member): JsonResponse
    {
        $this->authorize('view', $member);
        $this->authorize('viewAny', Payment::class);

        $payments = Payment::query()
            ->where(function ($query) use ($member): void {
                $query->whereHasMorph(
                    'payable',
                    [Subscription::class],
                    fn ($q) => $q->where('member_id', $member->id),
                );
                $query->orWhereHasMorph(
                    'payable',
                    [Sale::class],
                    fn ($q) => $q->where('member_id', $member->id),
                );
            })
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
}
