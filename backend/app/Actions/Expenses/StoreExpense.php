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
        activity('expenses')
            ->causedBy($user)
            ->performedOn($expense)
            ->event('created')
            ->withProperties([
                'expense_id' => $expense->id,
                'category' => $expense->category,
                'amount' => (string) $expense->amount,
                'date' => $expense->date?->toDateString(),
            ])
            ->log($user->name.' recorded '.$expense->category.' expense for EGP '.$expense->amount);

        return $expense;
    }
}
