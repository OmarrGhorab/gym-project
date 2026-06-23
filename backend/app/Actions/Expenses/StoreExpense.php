<?php

namespace App\Actions\Expenses;

use App\Models\Expense;
use App\Models\User;

final class StoreExpense
{
    public function handle(array $data, User $user): Expense
    {
        $data['created_by'] = $user->id;

        $expense = Expense::create($data);
        $expense->load('creator');

        return $expense;
    }
}
