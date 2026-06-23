<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

final class ImageUploadService
{
    /**
     * Store an uploaded image on the local disk.
     *
     * The file is stored to the given directory under the local disk root.
     * If the optional $oldPath is provided, the old file is deleted first.
     *
     * @throws \RuntimeException if storage fails
     */
    public function store(UploadedFile $file, string $directory, ?string $oldPath = null): string
    {
        if ($oldPath !== null) {
            Storage::disk('local')->delete($oldPath);
        }

        $path = $file->store($directory, 'local');

        if ($path === false) {
            throw new \RuntimeException('Failed to store uploaded image.');
        }

        return $path;
    }
}
