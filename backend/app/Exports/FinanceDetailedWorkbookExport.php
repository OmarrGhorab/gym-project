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
    ) {}

    public function sheets(): array
    {
        $report = app(FinanceDetailedExportData::class)->build($this->filters);
        $summary = $report['summary'];
        $meta = $report['meta'];

        return [
            new ArrayReportSheet('Summary', [
                ['Gym Finance Report'],
                ['Generated at', $meta['generated_at']],
                ['From', $meta['from']],
                ['To', $meta['to']],
                [],
                ['Metric', 'Value'],
                ['Collected revenue total', $summary['collected_revenue_total']],
                ['Subscription revenue collected', $summary['subscription_revenue_collected']],
                ['Add-on revenue collected', $summary['addon_revenue_collected']],
                ['POS revenue collected', $summary['pos_revenue_collected']],
                ['Other revenue collected', $summary['other_revenue_collected']],
                ['Booked subscriptions total', $summary['booked_subscriptions_total']],
                ['Booked add-ons total', $summary['booked_addons_total']],
                ['POS gross sales total', $summary['pos_gross_sales_total']],
                ['Expenses total', $summary['expenses_total']],
                ['Pending payroll total', $summary['pending_payroll_total']],
                ['Paid payroll total', $summary['paid_payroll_total']],
                ['Salary snapshot total', $summary['salary_snapshot_total']],
                ['Outstanding dues total', $summary['outstanding_dues_total']],
                ['Net profit after expenses', $summary['net_profit_after_expenses']],
                [],
                ['Count', 'Value'],
                ['Subscriptions', $summary['subscriptions_count']],
                ['Add-ons', $summary['addons_count']],
                ['POS sales', $summary['sales_count']],
                ['Payments', $summary['payments_count']],
                ['Expenses', $summary['expenses_count']],
                ['Payroll rows', $summary['payroll_count']],
                ['Employees', $summary['employees_count']],
            ]),
            $this->makeSheet('Subscriptions', $report['subscriptions']),
            $this->makeSheet('Add-ons', $report['addons']),
            $this->makeSheet('POS Sales', $report['sales']),
            $this->makeSheet('Payments', $report['payments']),
            $this->makeSheet('Payroll', $report['payroll']),
            $this->makeSheet('Salaries', $report['salaries']),
            $this->makeSheet('Expenses', $report['expenses']),
            $this->makeSheet('Expense Categories', $report['expenses_by_category']),
            $this->makeSheet('Outstanding Dues', $report['dues']),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function makeSheet(string $title, array $rows): ArrayReportSheet
    {
        if ($rows === []) {
            return new ArrayReportSheet($title, [[$title], ['No data available for the selected date range.']]);
        }

        $headers = array_keys($rows[0]);
        $sheetRows = [$headers];

        foreach ($rows as $row) {
            $sheetRows[] = array_values($row);
        }

        return new ArrayReportSheet($title, $sheetRows);
    }
}
