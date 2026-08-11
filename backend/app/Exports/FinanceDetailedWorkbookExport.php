<?php

namespace App\Exports;

use App\Actions\Reports\FinanceDetailedExportData;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class FinanceDetailedWorkbookExport implements WithMultipleSheets
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function __construct(
        private readonly array $filters,
        private readonly string $locale = 'en',
    ) {}

    public function sheets(): array
    {
        $report = app(FinanceDetailedExportData::class)->build($this->filters, $this->locale);
        $summary = $report['summary'];
        $meta = $report['meta'];

        return [
            new ArrayReportSheet($this->sheetTitle('summary'), [
                [$this->label('finance_report')],
                [$this->label('generated_at'), $meta['generated_at']],
                [$this->label('from'), $meta['from']],
                [$this->label('to'), $meta['to']],
                [],
                [$this->label('metric'), $this->label('value')],
                [$this->label('collected_revenue_total'), $summary['collected_revenue_total']],
                [$this->label('subscription_revenue_collected'), $summary['subscription_revenue_collected']],
                [$this->label('addon_revenue_collected'), $summary['addon_revenue_collected']],
                [$this->label('pos_revenue_collected'), $summary['pos_revenue_collected']],
                [$this->label('other_revenue_collected'), $summary['other_revenue_collected']],
                [$this->label('booked_subscriptions_total'), $summary['booked_subscriptions_total']],
                [$this->label('booked_addons_total'), $summary['booked_addons_total']],
                [$this->label('pos_gross_sales_total'), $summary['pos_gross_sales_total']],
                [$this->label('expenses_total'), $summary['expenses_total']],
                [$this->label('pending_payroll_total'), $summary['pending_payroll_total']],
                [$this->label('paid_payroll_total'), $summary['paid_payroll_total']],
                [$this->label('salary_snapshot_total'), $summary['salary_snapshot_total']],
                [$this->label('outstanding_dues_total'), $summary['outstanding_dues_total']],
                [$this->label('net_profit_after_expenses'), $summary['net_profit_after_expenses']],
                [],
                [$this->label('count'), $this->label('value')],
                [$this->label('subscriptions'), $summary['subscriptions_count']],
                [$this->label('addons'), $summary['addons_count']],
                [$this->label('pos_sales'), $summary['sales_count']],
                [$this->label('payments'), $summary['payments_count']],
                [$this->label('expenses'), $summary['expenses_count']],
                [$this->label('payroll_rows'), $summary['payroll_count']],
                [$this->label('employees'), $summary['employees_count']],
                [$this->label('shift_transactions'), $summary['shift_transactions_count']],
            ]),
            $this->makeSheet('shift_summary', $report['shift_summary']),
            $this->makeSheet('shift_transactions', $report['shift_transactions']),
            $this->makeSheet('subscriptions', $report['subscriptions']),
            $this->makeSheet('addons', $report['addons']),
            $this->makeSheet('pos_sales', $report['sales']),
            $this->makeSheet('payments', $report['payments']),
            $this->makeSheet('payroll', $report['payroll']),
            $this->makeSheet('salaries', $report['salaries']),
            $this->makeSheet('expenses', $report['expenses']),
            $this->makeSheet('expense_categories', $report['expenses_by_category']),
            $this->makeSheet('outstanding_dues', $report['dues']),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function makeSheet(string $titleKey, array $rows): ArrayReportSheet
    {
        $title = $this->sheetTitle($titleKey);

        if ($rows === []) {
            return new ArrayReportSheet($title, [[$title], [$this->label('no_data_available')]]);
        }

        $headers = array_map(fn (string $header): string => $this->label($header), array_keys($rows[0]));
        $sheetRows = [$headers];

        foreach ($rows as $row) {
            $sheetRows[] = array_values($row);
        }

        return new ArrayReportSheet($title, $sheetRows);
    }

    private function sheetTitle(string $key): string
    {
        $titles = [
            'addons' => ['ar' => 'الإضافات', 'en' => 'Add-ons'],
            'expense_categories' => ['ar' => 'فئات المصروفات', 'en' => 'Expense Categories'],
            'expenses' => ['ar' => 'المصروفات', 'en' => 'Expenses'],
            'outstanding_dues' => ['ar' => 'المستحقات', 'en' => 'Outstanding Dues'],
            'payments' => ['ar' => 'المدفوعات', 'en' => 'Payments'],
            'payroll' => ['ar' => 'الرواتب', 'en' => 'Payroll'],
            'pos_sales' => ['ar' => 'مبيعات نقطة البيع', 'en' => 'POS Sales'],
            'salaries' => ['ar' => 'المرتبات', 'en' => 'Salaries'],
            'shift_summary' => ['ar' => 'ملخص الشيفتات', 'en' => 'Shift Summary'],
            'shift_transactions' => ['ar' => 'حركات الشيفتات', 'en' => 'Shift Transactions'],
            'subscriptions' => ['ar' => 'الاشتراكات', 'en' => 'Subscriptions'],
            'summary' => ['ar' => 'الملخص', 'en' => 'Summary'],
        ];

        return $titles[$key][$this->locale] ?? $titles[$key]['en'] ?? $key;
    }

    private function label(string $key): string
    {
        $labels = [
            'addon_id' => ['ar' => 'رقم الإضافة', 'en' => 'Add-on ID'],
            'addon_revenue_collected' => ['ar' => 'الإيراد المحصل من الإضافات', 'en' => 'Add-on revenue collected'],
            'addons' => ['ar' => 'الإضافات', 'en' => 'Add-ons'],
            'addons_count' => ['ar' => 'عدد الإضافات', 'en' => 'Add-ons'],
            'amount' => ['ar' => 'المبلغ', 'en' => 'Amount'],
            'balance' => ['ar' => 'الرصيد', 'en' => 'Balance'],
            'base_salary' => ['ar' => 'الراتب الأساسي', 'en' => 'Base salary'],
            'booked_addons_total' => ['ar' => 'إجمالي قيمة الإضافات', 'en' => 'Booked add-ons total'],
            'booked_amount' => ['ar' => 'القيمة المسجلة', 'en' => 'Booked amount'],
            'booked_price' => ['ar' => 'القيمة المسجلة', 'en' => 'Booked price'],
            'booked_subscriptions_total' => ['ar' => 'إجمالي قيمة الاشتراكات', 'en' => 'Booked subscriptions total'],
            'booked_total' => ['ar' => 'الإجمالي المسجل', 'en' => 'Booked total'],
            'bonuses' => ['ar' => 'المكافآت', 'en' => 'Bonuses'],
            'category' => ['ar' => 'الفئة', 'en' => 'Category'],
            'coach' => ['ar' => 'المدرب', 'en' => 'Coach'],
            'collected' => ['ar' => 'المحصل', 'en' => 'Collected'],
            'collected_amount' => ['ar' => 'المبلغ المحصل', 'en' => 'Collected amount'],
            'collected_revenue_total' => ['ar' => 'إجمالي الإيراد المحصل', 'en' => 'Collected revenue total'],
            'commissions_total' => ['ar' => 'إجمالي العمولات', 'en' => 'Commissions total'],
            'count' => ['ar' => 'العدد', 'en' => 'Count'],
            'created_at' => ['ar' => 'تاريخ الإنشاء', 'en' => 'Created at'],
            'created_by' => ['ar' => 'أضيف بواسطة', 'en' => 'Created by'],
            'date' => ['ar' => 'التاريخ', 'en' => 'Date'],
            'deductions' => ['ar' => 'الخصومات', 'en' => 'Deductions'],
            'description' => ['ar' => 'الوصف', 'en' => 'Description'],
            'employee' => ['ar' => 'الموظف', 'en' => 'Employee'],
            'employee_id' => ['ar' => 'رقم الموظف', 'en' => 'Employee ID'],
            'employees' => ['ar' => 'الموظفون', 'en' => 'Employees'],
            'employees_count' => ['ar' => 'عدد الموظفين', 'en' => 'Employees'],
            'end_date' => ['ar' => 'تاريخ الانتهاء', 'en' => 'End date'],
            'entries' => ['ar' => 'عدد البنود', 'en' => 'Entries'],
            'expenses' => ['ar' => 'المصروفات', 'en' => 'Expenses'],
            'expenses_count' => ['ar' => 'عدد المصروفات', 'en' => 'Expenses'],
            'expenses_total' => ['ar' => 'إجمالي المصروفات', 'en' => 'Expenses total'],
            'expense_amount' => ['ar' => 'قيمة المصروف', 'en' => 'Expense amount'],
            'finance_report' => ['ar' => 'التقرير المالي للجيم', 'en' => 'Gym Finance Report'],
            'from' => ['ar' => 'من', 'en' => 'From'],
            'generated_at' => ['ar' => 'تاريخ الإنشاء', 'en' => 'Generated at'],
            'hire_date' => ['ar' => 'تاريخ التعيين', 'en' => 'Hire date'],
            'item' => ['ar' => 'البند', 'en' => 'Item'],
            'items' => ['ar' => 'العناصر', 'en' => 'Items'],
            'handled_by' => ['ar' => 'تم بواسطة', 'en' => 'Handled by'],
            'handled_by_role' => ['ar' => 'دور المنفذ', 'en' => 'Handler role'],
            'handled_by_shift' => ['ar' => 'شيفت المنفذ', 'en' => 'Handler assigned shift'],
            'member' => ['ar' => 'العضو', 'en' => 'Member'],
            'method' => ['ar' => 'الطريقة', 'en' => 'Method'],
            'metric' => ['ar' => 'المؤشر', 'en' => 'Metric'],
            'month' => ['ar' => 'الشهر', 'en' => 'Month'],
            'net_profit_after_expenses' => ['ar' => 'صافي الربح بعد المصروفات', 'en' => 'Net profit after expenses'],
            'net_cash' => ['ar' => 'صافي النقد', 'en' => 'Net cash'],
            'net_salary' => ['ar' => 'صافي الراتب', 'en' => 'Net salary'],
            'no_data_available' => ['ar' => 'لا توجد بيانات في هذا النطاق المحدد.', 'en' => 'No data available for the selected date range.'],
            'other_revenue_collected' => ['ar' => 'الإيراد المحصل الآخر', 'en' => 'Other revenue collected'],
            'outstanding_dues_total' => ['ar' => 'إجمالي المستحقات', 'en' => 'Outstanding dues total'],
            'paid_at' => ['ar' => 'تاريخ الدفع', 'en' => 'Paid at'],
            'paid_payroll_total' => ['ar' => 'إجمالي الرواتب المدفوعة', 'en' => 'Paid payroll total'],
            'pay_day' => ['ar' => 'يوم الصرف', 'en' => 'Pay day'],
            'payment_id' => ['ar' => 'رقم الدفعة', 'en' => 'Payment ID'],
            'payment_method' => ['ar' => 'طريقة الدفع', 'en' => 'Payment method'],
            'payments' => ['ar' => 'المدفوعات', 'en' => 'Payments'],
            'payments_count' => ['ar' => 'عدد المدفوعات', 'en' => 'Payments'],
            'payroll_id' => ['ar' => 'رقم الرواتب', 'en' => 'Payroll ID'],
            'payroll_rows' => ['ar' => 'صفوف الرواتب', 'en' => 'Payroll rows'],
            'pending_payroll_total' => ['ar' => 'إجمالي الرواتب المعلقة', 'en' => 'Pending payroll total'],
            'plan' => ['ar' => 'الخطة', 'en' => 'Plan'],
            'pos_gross_sales_total' => ['ar' => 'إجمالي مبيعات نقطة البيع', 'en' => 'POS gross sales total'],
            'pos_revenue_collected' => ['ar' => 'الإيراد المحصل من نقطة البيع', 'en' => 'POS revenue collected'],
            'pos_sales' => ['ar' => 'مبيعات نقطة البيع', 'en' => 'POS sales'],
            'product' => ['ar' => 'المنتج', 'en' => 'Product'],
            'record_id' => ['ar' => 'رقم السجل', 'en' => 'Record ID'],
            'role' => ['ar' => 'الدور', 'en' => 'Role'],
            'salary_snapshot_total' => ['ar' => 'إجمالي المرتبات الحالية', 'en' => 'Salary snapshot total'],
            'sale_id' => ['ar' => 'رقم البيع', 'en' => 'Sale ID'],
            'sales_count' => ['ar' => 'عدد المبيعات', 'en' => 'POS sales'],
            'seller' => ['ar' => 'البائع', 'en' => 'Seller'],
            'service' => ['ar' => 'الخدمة', 'en' => 'Service'],
            'shift' => ['ar' => 'الشيفت', 'en' => 'Shift'],
            'shift_summary' => ['ar' => 'ملخص الشيفتات', 'en' => 'Shift summary'],
            'shift_time' => ['ar' => 'وقت الشيفت', 'en' => 'Shift time'],
            'shift_transactions' => ['ar' => 'حركات الشيفتات', 'en' => 'Shift transactions'],
            'sold_at' => ['ar' => 'تاريخ البيع', 'en' => 'Sold at'],
            'sold_by' => ['ar' => 'تم البيع بواسطة', 'en' => 'Sold by'],
            'source' => ['ar' => 'المصدر', 'en' => 'Source'],
            'staff_on_shift' => ['ar' => 'طاقم الشيفت', 'en' => 'Staff on shift'],
            'start_date' => ['ar' => 'تاريخ البدء', 'en' => 'Start date'],
            'status' => ['ar' => 'الحالة', 'en' => 'Status'],
            'subscription_id' => ['ar' => 'رقم الاشتراك', 'en' => 'Subscription ID'],
            'subscription_revenue_collected' => ['ar' => 'الإيراد المحصل من الاشتراكات', 'en' => 'Subscription revenue collected'],
            'subscriptions' => ['ar' => 'الاشتراكات', 'en' => 'Subscriptions'],
            'subscriptions_count' => ['ar' => 'عدد الاشتراكات', 'en' => 'Subscriptions'],
            'subtotal' => ['ar' => 'الإجمالي قبل الخصم', 'en' => 'Subtotal'],
            'to' => ['ar' => 'إلى', 'en' => 'To'],
            'total' => ['ar' => 'الإجمالي', 'en' => 'Total'],
            'transaction_at' => ['ar' => 'وقت الحركة', 'en' => 'Transaction at'],
            'transactions' => ['ar' => 'عدد الحركات', 'en' => 'Transactions'],
            'type' => ['ar' => 'النوع', 'en' => 'Type'],
            'value' => ['ar' => 'القيمة', 'en' => 'Value'],
        ];

        return $labels[$key][$this->locale] ?? $labels[$key]['en'] ?? $key;
    }
}
