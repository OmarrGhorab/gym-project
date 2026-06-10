<?php

namespace App\Actions\Members;

use App\Models\Member;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

final class StoreMemberPhoto
{
    public function handle(Member $member, UploadedFile $photo): Member
    {
        $path = $photo->store("members/photos/{$member->id}", 'local');

        // Persist photo_path only after successful store (transactional ordering).
        DB::transaction(function () use ($member, $path): void {
            $member->update(['photo_path' => $path]);
        });

        return $member->fresh();
    }
}
