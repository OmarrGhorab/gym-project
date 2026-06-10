<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Foundation setting stored as a key/value pair.
 *
 * Values are cast to/from JSON so callers can store scalars, arrays, or objects
 * without manual encode/decode. The unique constraint on `key` is enforced at
 * the database level (see the migration) and at the application level via
 * updateOrCreate in StoreSetting.
 *
 * @property int $id
 * @property string $key
 * @property mixed $value
 */
class Setting extends Model
{
    // Explicit allowlist — mass-assignment protection (Constitution §V).
    protected $fillable = [
        'key',
        'value',
    ];

    // No sensitive fields on this model — nothing to hide.

    protected $casts = [
        // JSON cast handles scalar, array, and object values transparently.
        'value' => 'json',
    ];
}
