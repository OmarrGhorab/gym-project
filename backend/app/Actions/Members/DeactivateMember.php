<?php

namespace App\Actions\Members;

use App\Models\Member;

final class DeactivateMember
{
    public function handle(Member $member): Member
    {
        $member->update(['status' => 'inactive']);

        return $member;
    }
}
