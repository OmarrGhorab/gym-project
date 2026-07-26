<?php

namespace App\Support;

use App\Models\Setting;

final class Geofence
{
    /**
     * @param  array<string, mixed>  $data
     * @return array{latitude: ?float, longitude: ?float, accuracy_meters: ?int, distance_meters: ?int, location_status: ?string}
     */
    public function evaluate(array $data): array
    {
        $latitude = isset($data['latitude']) ? (float) $data['latitude'] : null;
        $longitude = isset($data['longitude']) ? (float) $data['longitude'] : null;
        $accuracy = isset($data['accuracy_meters']) ? (int) $data['accuracy_meters'] : null;

        if ($latitude === null || $longitude === null) {
            return [
                'latitude' => null,
                'longitude' => null,
                'accuracy_meters' => $accuracy,
                'distance_meters' => null,
                'location_status' => 'missing',
            ];
        }

        $settings = Setting::query()
            ->whereIn('key', [
                'attendance.gym_latitude',
                'attendance.gym_longitude',
                'attendance.gym_radius_meters',
            ])
            ->pluck('value', 'key');

        $gymLat = $this->toFloat($settings->get('attendance.gym_latitude'));
        $gymLng = $this->toFloat($settings->get('attendance.gym_longitude'));
        $radius = $this->toInt($settings->get('attendance.gym_radius_meters'), 150);

        if ($gymLat === null || $gymLng === null) {
            return [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'accuracy_meters' => $accuracy,
                'distance_meters' => null,
                'location_status' => 'unconfigured',
            ];
        }

        $distance = $this->distanceMeters($latitude, $longitude, $gymLat, $gymLng);

        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy_meters' => $accuracy,
            'distance_meters' => $distance,
            'location_status' => $distance <= $radius ? 'inside' : 'outside',
        ];
    }

    private function toFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) $value;
    }

    private function toInt(mixed $value, int $default): int
    {
        return $value === null || $value === '' ? $default : (int) $value;
    }

    private function distanceMeters(float $lat1, float $lon1, float $lat2, float $lon2): int
    {
        $earthRadius = 6371000;
        $latDelta = deg2rad($lat2 - $lat1);
        $lonDelta = deg2rad($lon2 - $lon1);
        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lonDelta / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return (int) round($earthRadius * $c);
    }
}
