<?php

namespace App\Actions\Expenses;

use App\Actions\ShiftSessions\ResolveOpenShiftSession;
use App\Models\Expense;
use App\Models\User;
use App\Services\OperationalNotifier;

final class StoreExpense
{
    public function __construct(
        private readonly OperationalNotifier $notifier,
        private readonly ResolveOpenShiftSession $openShiftSession,
    ) {}

    public function handle(array $data, User $user): Expense
    {
        $data['created_by'] = $user->id;

        // Always prefer an explicitly open desk session so expenses hit Shift desk totals.
        $openSession = $this->openShiftSession->current();
        if ($openSession !== null) {
            $data['shift_session_id'] = $openSession->id;
        } elseif (empty($data['shift_session_id'])) {
            $data['shift_session_id'] = null;
        }

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

        $this->notifier->expenseCreated($expense);

        return $expense;
    }
}
