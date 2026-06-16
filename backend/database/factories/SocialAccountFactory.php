<?php

namespace Database\Factories;

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialAccount>
 */
class SocialAccountFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<SocialAccount>
     */
    protected $model = SocialAccount::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'provider' => 'google',
            'provider_id' => fake()->uuid(),
            'nickname' => fake()->userName(),
            'avatar' => fake()->imageUrl(),
            'access_token' => fake()->sha256(),
            'refresh_token' => fake()->sha256(),
            'token_expires_at' => now()->addHour(),
        ];
    }
}
