<?php

namespace App\Http\Resources\Concerns;

use Illuminate\Http\Request;

/**
 * Mixes the standard API success envelope into any JSON Resource or
 * ResourceCollection.
 *
 * Usage: add `use WrapsApiResponse;` to a resource class, then call
 * `$this->withMessage('...')` to set the human-readable envelope message.
 *
 * The envelope shape is: { data: <resource>, meta: {}, message: "..." }
 *
 * The `data` key is handled automatically by Laravel's `JsonResource`
 * wrapper — this trait adds `meta` and `message` alongside it via
 * `with()`.
 */
trait WrapsApiResponse
{
    protected string $envelopeMessage = '';

    /** @var array<string,mixed> */
    protected array $envelopeMeta = [];

    /**
     * Set the human-readable message included in the success envelope.
     *
     * Fluent — returns $this so callers can chain:
     *   `return (new UserResource($user))->withMessage('Current user');`
     */
    public function withMessage(string $message): static
    {
        $this->envelopeMessage = $message;

        return $this;
    }

    /**
     * Set additional meta included alongside `data` in the envelope.
     *
     * @param  array<string,mixed>  $meta
     */
    public function withMeta(array $meta): static
    {
        $this->envelopeMeta = $meta;

        return $this;
    }

    /**
     * Add envelope keys (`meta`, `message`) to the resource response.
     *
     * Called automatically by Laravel when serialising a JsonResource.
     *
     * @return array<string,mixed>
     */
    public function with(Request $request): array
    {
        return [
            'meta' => (object) $this->envelopeMeta,
            'message' => $this->envelopeMessage,
        ];
    }
}
