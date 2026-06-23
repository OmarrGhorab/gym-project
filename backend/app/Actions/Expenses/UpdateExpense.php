<?php

namespace App\Actions\Expenses;

use App\Models\Expense;

final class UpdateExpense
{
    public function handle(Expense $expense, array $data): Expense
    {
        $expense->update($data);
        $expense->load('creator');

        return $expense;
    }
}
