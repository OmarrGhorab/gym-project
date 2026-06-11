<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;
use App\Support\PosPermissions;

class ProductPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PosPermissions::PERM_PRODUCTS_VIEW);
    }

    public function view(User $user, Product $product): bool
    {
        return $user->can(PosPermissions::PERM_PRODUCTS_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->can(PosPermissions::PERM_PRODUCTS_CREATE);
    }

    public function update(User $user, Product $product): bool
    {
        return $user->can(PosPermissions::PERM_PRODUCTS_UPDATE);
    }

    public function delete(User $user, Product $product): bool
    {
        return $user->can(PosPermissions::PERM_PRODUCTS_DELETE);
    }

    public function adjustStock(User $user, Product $product): bool
    {
        return $user->can(PosPermissions::PERM_INVENTORY_ADJUST);
    }
}
