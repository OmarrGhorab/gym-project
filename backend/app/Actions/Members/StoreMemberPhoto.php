<?php

namespace App\Actions\Members;

use App\Models\Member;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

final class StoreMemberPhoto
{
    public function handle(Member $member, UploadedFile $photo): Member
    {
        $path = $photo->store("members/photos/{$member->id}", 'local');

        try {
            $member->update(['photo_path' => $path]);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);

            throw $e;
        }

        return $member->fresh();
    }
}
