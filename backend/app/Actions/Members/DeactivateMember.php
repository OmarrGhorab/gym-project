<?php

namespace App\Actions\Members;

use App\Models\Member;
use Illuminate\Support\Facades\DB;

final class DeactivateMember
{
    public function handle(Member $member): Member
    {
        return DB::transaction(function () use ($member): Member {
            $member->update(['status' => 'inactive']);

            $member->subscriptions()
                ->where('status', 'active')
                ->update(['status' => 'stopped']);

            return $member;
        });
    }
}
