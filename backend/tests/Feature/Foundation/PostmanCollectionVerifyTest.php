<?php

describe('Postman Collections & Environment Verification', function () {
    it('has a valid environment configuration file', function () {
        $envPath = base_path('postman_collections/Gym-project.postman_environment.json');

        expect(file_exists($envPath))->toBeTrue();

        $json = json_decode(file_get_contents($envPath), true);
        expect(json_last_error())->toBe(JSON_ERROR_NONE);

        expect($json)->toHaveKey('name');
        expect($json['name'])->toBe('Gym Project Environment');
        expect($json)->toHaveKey('values');
        expect($json['values'])->toBeArray();
        expect(count($json['values']))->toBeGreaterThan(0);

        $values = collect($json['values'])->pluck('value', 'key');
        expect($values->get('admin_email'))->toBe('admin@gym.test');
        expect($values->get('manager_email'))->toBe('manager@gym.test');
        expect($values->get('cashier_email'))->toBe('cashier@gym.test');
        expect($values->get('captain_email'))->toBe('captain@gym.test');
        expect($values->get('accountant_email'))->toBe('accountant@gym.test');
    });

    it('has a valid 001-backend-foundation collection', function () {
        $path = base_path('postman_collections/001-backend-foundation.postman_collection.json');

        expect(file_exists($path))->toBeTrue();

        $json = json_decode(file_get_contents($path), true);
        expect(json_last_error())->toBe(JSON_ERROR_NONE);

        expect($json)->toHaveKey('info');
        expect($json['info'])->toHaveKey('name');
        expect($json['info']['name'])->toBe('001-backend-foundation');
        expect($json['info']['schema'])->toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json');

        expect($json)->toHaveKey('item');
        expect($json['item'])->toBeArray();
        expect(collect($json['item'])->pluck('name')->all())->toContain('Auth');
    });

    it('has a valid 002-members-subscriptions-plans collection', function () {
        $path = base_path('postman_collections/002-members-subscriptions-plans.postman_collection.json');

        expect(file_exists($path))->toBeTrue();

        $json = json_decode(file_get_contents($path), true);
        expect(json_last_error())->toBe(JSON_ERROR_NONE);

        expect($json)->toHaveKey('info');
        expect($json['info'])->toHaveKey('name');
        expect($json['info']['name'])->toBe('002-members-subscriptions-plans');
        expect($json['info']['schema'])->toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json');

        expect($json)->toHaveKey('item');
        expect($json['item'])->toBeArray();
        expect(collect($json['item'])->pluck('name')->all())->toContain(
            'Members',
            'Plans',
            'Subscriptions',
            'Payments',
            'Notifications',
            'Dashboard',
        );
    });

    it('has a valid 003-pos-products-inventory collection', function () {
        $path = base_path('postman_collections/003-pos-products-inventory.postman_collection.json');

        expect(file_exists($path))->toBeTrue();

        $json = json_decode(file_get_contents($path), true);
        expect(json_last_error())->toBe(JSON_ERROR_NONE);

        expect($json)->toHaveKey('info');
        expect($json['info'])->toHaveKey('name');
        expect($json['info']['name'])->toBe('003-pos-products-inventory');
        expect($json['info']['schema'])->toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json');

        expect($json)->toHaveKey('item');
        expect($json['item'])->toBeArray();
        expect(collect($json['item'])->pluck('name')->all())->toContain(
            'Products',
            'Sales',
            'Dashboard Widgets',
        );
    });

    it('has a valid 004-hr-finance-reports-admin collection', function () {
        $path = base_path('postman_collections/004-hr-finance-reports-admin.postman_collection.json');

        expect(file_exists($path))->toBeTrue();

        $json = json_decode(file_get_contents($path), true);
        expect(json_last_error())->toBe(JSON_ERROR_NONE);

        expect($json)->toHaveKey('info');
        expect($json['info'])->toHaveKey('name');
        expect($json['info']['name'])->toBe('004-hr-finance-reports-admin');
        expect($json['info']['schema'])->toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json');

        expect($json)->toHaveKey('item');
        expect($json['item'])->toBeArray();
        expect(collect($json['item'])->pluck('name')->all())->toContain(
            'Employees',
            'Expenses',
            'Payroll',
            'Commissions',
            'Reports',
            'Settings',
            'Roles & Permissions',
            'Audit Logs',
            'Export',
        );
    });
});
