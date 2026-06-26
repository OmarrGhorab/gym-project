<?php

namespace App\Actions\MemberVisits;

use App\Models\MemberVisit;

final class UpdateMemberVisit
{
    public function handle(MemberVisit $visit, array $data): MemberVisit
    {
        $visit->update($data);

        return $visit->load(['member.latestSubscription.plan', 'subscription.plan', 'creator']);
    }
}
