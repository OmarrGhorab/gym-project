<?php

namespace App\Actions\Members;

use App\Models\Member;
use App\Services\ImageUploadService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

final class StoreMemberPhoto
{
    public function handle(Member $member, UploadedFile $photo): Member
    {
        $service = app(ImageUploadService::class);
        $path = $service->store($photo, "members/photos/{$member->id}");

        try {
            $member->update(['photo_path' => $path]);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);

            throw $e;
        }

        return $member->fresh();
    }
}
