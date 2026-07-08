<!DOCTYPE html>
<html lang="{{ $isRtl ? 'ar' : 'en' }}" dir="{{ $isRtl ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="utf-8">
    <title>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'التقرير المالي' : 'Finance Report') }}</title>
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #111827;
            direction: {{ $isRtl ? 'rtl' : 'ltr' }};
        }
        h1, h2 {
            margin: 0 0 8px;
            text-align: {{ $isRtl ? 'right' : 'left' }};
        }
        h2 {
            margin-top: 20px;
            font-size: 14px;
            page-break-after: avoid;
        }
        .meta, .summary {
            margin-bottom: 14px;
            text-align: {{ $isRtl ? 'right' : 'left' }};
        }
        .summary-grid {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .summary-grid td, .summary-grid th,
        table.data td, table.data th {
            border: 1px solid #d1d5db;
            padding: 6px 8px;
            text-align: {{ $isRtl ? 'right' : 'left' }};
            vertical-align: top;
            word-wrap: break-word;
        }
        .summary-grid th, table.data th {
            background: #f3f4f6;
        }
        table.data {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
            margin-top: 8px;
            font-size: 9px;
        }
        table.data tr {
            page-break-inside: avoid;
        }
        table.data td, table.data th {
            padding: 4px 5px;
        }
        .section-note {
            color: #6b7280;
            font-size: 10px;
            margin-top: 2px;
            text-align: {{ $isRtl ? 'right' : 'left' }};
        }
        .compact-table {
            font-size: 8px;
        }
        .transaction-card {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            margin-top: 8px;
            padding: 8px;
            page-break-inside: avoid;
        }
        .transaction-card-header {
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 6px;
            padding-bottom: 5px;
        }
        .transaction-title {
            font-size: 12px;
            font-weight: bold;
        }
        .transaction-meta {
            color: #4b5563;
            font-size: 9px;
            margin-top: 2px;
        }
        .transaction-grid {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .transaction-grid td {
            border: 0;
            padding: 3px 4px;
            vertical-align: top;
            width: 25%;
        }
        .field-label {
            color: #6b7280;
            display: block;
            font-size: 8px;
            font-weight: bold;
            margin-bottom: 1px;
        }
        .field-value {
            font-size: 9px;
        }
        .amount-positive {
            color: #047857;
            font-weight: bold;
        }
        .amount-negative {
            color: #b91c1c;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'التقرير المالي للجيم' : 'Gym Finance Report') }}</h1>

    <div class="meta">
        <div>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'تاريخ الإنشاء' : 'Generated at') }}: {{ $pdfText($report['meta']['generated_at']) }}</div>
        <div>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'من' : 'From') }}: {{ $pdfText($report['meta']['from']) }}</div>
        <div>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'إلى' : 'To') }}: {{ $pdfText($report['meta']['to']) }}</div>
    </div>

    <div class="summary">
        <h2>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'الملخص' : 'Summary') }}</h2>
        <table class="summary-grid">
            <thead>
                <tr>
                    <th>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'المؤشر' : 'Metric') }}</th>
                    <th>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'القيمة' : 'Value') }}</th>
                </tr>
            </thead>
            <tbody>
                @foreach ([
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي الإيراد المحصل' : 'Collected revenue total') => $report['summary']['collected_revenue_total'],
                    ($report['meta']['locale'] === 'ar' ? 'الإيراد المحصل من الاشتراكات' : 'Subscription revenue collected') => $report['summary']['subscription_revenue_collected'],
                    ($report['meta']['locale'] === 'ar' ? 'الإيراد المحصل من الإضافات' : 'Add-on revenue collected') => $report['summary']['addon_revenue_collected'],
                    ($report['meta']['locale'] === 'ar' ? 'الإيراد المحصل من نقطة البيع' : 'POS revenue collected') => $report['summary']['pos_revenue_collected'],
                    ($report['meta']['locale'] === 'ar' ? 'الإيراد المحصل الآخر' : 'Other revenue collected') => $report['summary']['other_revenue_collected'],
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي قيمة الاشتراكات' : 'Booked subscriptions total') => $report['summary']['booked_subscriptions_total'],
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي قيمة الإضافات' : 'Booked add-ons total') => $report['summary']['booked_addons_total'],
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي مبيعات نقطة البيع' : 'POS gross sales total') => $report['summary']['pos_gross_sales_total'],
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي المصروفات' : 'Expenses total') => $report['summary']['expenses_total'],
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي الرواتب المعلقة' : 'Pending payroll total') => $report['summary']['pending_payroll_total'],
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي الرواتب المدفوعة' : 'Paid payroll total') => $report['summary']['paid_payroll_total'],
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي المرتبات الحالية' : 'Salary snapshot total') => $report['summary']['salary_snapshot_total'],
                    ($report['meta']['locale'] === 'ar' ? 'إجمالي المستحقات' : 'Outstanding dues total') => $report['summary']['outstanding_dues_total'],
                    ($report['meta']['locale'] === 'ar' ? 'صافي الربح بعد المصروفات' : 'Net profit after expenses') => $report['summary']['net_profit_after_expenses'],
                ] as $label => $value)
                    <tr>
                        <td>{{ $pdfText($label) }}</td>
                        <td>{{ $pdfText($value) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    @php
        $sectionLabels = [
            'subscriptions' => $report['meta']['locale'] === 'ar' ? 'الاشتراكات' : 'Subscriptions',
            'shift_summary' => $report['meta']['locale'] === 'ar' ? 'ملخص الشيفتات' : 'Shift Summary',
            'shift_transactions' => $report['meta']['locale'] === 'ar' ? 'حركات الشيفتات' : 'Shift Transactions',
            'addons' => $report['meta']['locale'] === 'ar' ? 'الإضافات' : 'Add-ons',
            'sales' => $report['meta']['locale'] === 'ar' ? 'مبيعات نقطة البيع' : 'POS Sales',
            'payments' => $report['meta']['locale'] === 'ar' ? 'المدفوعات' : 'Payments',
            'payroll' => $report['meta']['locale'] === 'ar' ? 'الرواتب' : 'Payroll',
            'salaries' => $report['meta']['locale'] === 'ar' ? 'المرتبات' : 'Salaries',
            'expenses' => $report['meta']['locale'] === 'ar' ? 'المصروفات' : 'Expenses',
            'expenses_by_category' => $report['meta']['locale'] === 'ar' ? 'فئات المصروفات' : 'Expense Categories',
            'dues' => $report['meta']['locale'] === 'ar' ? 'المستحقات' : 'Outstanding Dues',
        ];
        $sections = [
            'subscriptions' => $report['subscriptions'],
            'shift_summary' => $report['shift_summary'],
            'shift_transactions' => $report['shift_transactions'],
            'addons' => $report['addons'],
            'sales' => $report['sales'],
            'payments' => $report['payments'],
            'payroll' => $report['payroll'],
            'salaries' => $report['salaries'],
            'expenses' => $report['expenses'],
            'expenses_by_category' => $report['expenses_by_category'],
            'dues' => $report['dues'],
        ];
        $headerLabel = function (string $header) use ($report): string {
            return match ($header) {
                'addon_id' => $report['meta']['locale'] === 'ar' ? 'رقم الإضافة' : 'Add-on ID',
                'amount' => $report['meta']['locale'] === 'ar' ? 'المبلغ' : 'Amount',
                'attendance_deductions' => $report['meta']['locale'] === 'ar' ? 'خصومات الحضور' : 'Attendance deductions',
                'balance' => $report['meta']['locale'] === 'ar' ? 'الرصيد' : 'Balance',
                'base_salary' => $report['meta']['locale'] === 'ar' ? 'الراتب الأساسي' : 'Base salary',
                'booked_amount' => $report['meta']['locale'] === 'ar' ? 'القيمة المسجلة' : 'Booked amount',
                'booked_price' => $report['meta']['locale'] === 'ar' ? 'القيمة المسجلة' : 'Booked price',
                'booked_total' => $report['meta']['locale'] === 'ar' ? 'الإجمالي المسجل' : 'Booked total',
                'bonuses' => $report['meta']['locale'] === 'ar' ? 'المكافآت' : 'Bonuses',
                'category' => $report['meta']['locale'] === 'ar' ? 'الفئة' : 'Category',
                'coach' => $report['meta']['locale'] === 'ar' ? 'المدرب' : 'Coach',
                'collected' => $report['meta']['locale'] === 'ar' ? 'المحصل' : 'Collected',
                'collected_amount' => $report['meta']['locale'] === 'ar' ? 'المبلغ المحصل' : 'Collected amount',
                'commission_rate' => $report['meta']['locale'] === 'ar' ? 'نسبة العمولة' : 'Commission rate',
                'commissions_total' => $report['meta']['locale'] === 'ar' ? 'إجمالي العمولات' : 'Commissions total',
                'created_at' => $report['meta']['locale'] === 'ar' ? 'تاريخ الإنشاء' : 'Created at',
                'created_by' => $report['meta']['locale'] === 'ar' ? 'أضيف بواسطة' : 'Created by',
                'date' => $report['meta']['locale'] === 'ar' ? 'التاريخ' : 'Date',
                'deductions' => $report['meta']['locale'] === 'ar' ? 'الخصومات' : 'Deductions',
                'description' => $report['meta']['locale'] === 'ar' ? 'الوصف' : 'Description',
                'details' => $report['meta']['locale'] === 'ar' ? 'التفاصيل' : 'Details',
                'employee' => $report['meta']['locale'] === 'ar' ? 'الموظف' : 'Employee',
                'employee_id' => $report['meta']['locale'] === 'ar' ? 'رقم الموظف' : 'Employee ID',
                'end_date' => $report['meta']['locale'] === 'ar' ? 'تاريخ الانتهاء' : 'End date',
                'entries' => $report['meta']['locale'] === 'ar' ? 'عدد البنود' : 'Entries',
                'expense_amount' => $report['meta']['locale'] === 'ar' ? 'قيمة المصروف' : 'Expense amount',
                'handled_by' => $report['meta']['locale'] === 'ar' ? 'تم بواسطة' : 'Handled by',
                'handled_by_role' => $report['meta']['locale'] === 'ar' ? 'دور المنفذ' : 'Handler role',
                'handled_by_shift' => $report['meta']['locale'] === 'ar' ? 'شيفت المنفذ' : 'Handler assigned shift',
                'hire_date' => $report['meta']['locale'] === 'ar' ? 'تاريخ التعيين' : 'Hire date',
                'item' => $report['meta']['locale'] === 'ar' ? 'البند' : 'Item',
                'items' => $report['meta']['locale'] === 'ar' ? 'العناصر' : 'Items',
                'member' => $report['meta']['locale'] === 'ar' ? 'العضو' : 'Member',
                'method' => $report['meta']['locale'] === 'ar' ? 'الطريقة' : 'Method',
                'month' => $report['meta']['locale'] === 'ar' ? 'الشهر' : 'Month',
                'net_cash' => $report['meta']['locale'] === 'ar' ? 'صافي النقد' : 'Net cash',
                'net_salary' => $report['meta']['locale'] === 'ar' ? 'صافي الراتب' : 'Net salary',
                'paid_at' => $report['meta']['locale'] === 'ar' ? 'تاريخ الدفع' : 'Paid at',
                'pay_day' => $report['meta']['locale'] === 'ar' ? 'يوم الصرف' : 'Pay day',
                'payment_id' => $report['meta']['locale'] === 'ar' ? 'رقم الدفعة' : 'Payment ID',
                'payment_method' => $report['meta']['locale'] === 'ar' ? 'طريقة الدفع' : 'Payment method',
                'payroll_id' => $report['meta']['locale'] === 'ar' ? 'رقم الرواتب' : 'Payroll ID',
                'plan' => $report['meta']['locale'] === 'ar' ? 'الخطة' : 'Plan',
                'record_id' => $report['meta']['locale'] === 'ar' ? 'رقم السجل' : 'Record ID',
                'role' => $report['meta']['locale'] === 'ar' ? 'الدور' : 'Role',
                'sale_id' => $report['meta']['locale'] === 'ar' ? 'رقم البيع' : 'Sale ID',
                'seller' => $report['meta']['locale'] === 'ar' ? 'البائع' : 'Seller',
                'service' => $report['meta']['locale'] === 'ar' ? 'الخدمة' : 'Service',
                'shift' => $report['meta']['locale'] === 'ar' ? 'الشيفت' : 'Shift',
                'shift_time' => $report['meta']['locale'] === 'ar' ? 'وقت الشيفت' : 'Shift time',
                'sold_at' => $report['meta']['locale'] === 'ar' ? 'تاريخ البيع' : 'Sold at',
                'sold_by' => $report['meta']['locale'] === 'ar' ? 'تم البيع بواسطة' : 'Sold by',
                'source' => $report['meta']['locale'] === 'ar' ? 'المصدر' : 'Source',
                'staff_on_shift' => $report['meta']['locale'] === 'ar' ? 'طاقم الشيفت' : 'Staff on shift',
                'start_date' => $report['meta']['locale'] === 'ar' ? 'تاريخ البدء' : 'Start date',
                'status' => $report['meta']['locale'] === 'ar' ? 'الحالة' : 'Status',
                'subscription_id' => $report['meta']['locale'] === 'ar' ? 'رقم الاشتراك' : 'Subscription ID',
                'subtotal' => $report['meta']['locale'] === 'ar' ? 'الإجمالي قبل الخصم' : 'Subtotal',
                'total' => $report['meta']['locale'] === 'ar' ? 'الإجمالي' : 'Total',
                'transaction_at' => $report['meta']['locale'] === 'ar' ? 'وقت الحركة' : 'Transaction at',
                'transactions' => $report['meta']['locale'] === 'ar' ? 'عدد الحركات' : 'Transactions',
                'type' => $report['meta']['locale'] === 'ar' ? 'النوع' : 'Type',
                default => \Illuminate\Support\Str::headline(str_replace('_', ' ', $header)),
            };
        };
    @endphp

    @foreach ($sections as $sectionKey => $rows)
        @php($title = $sectionLabels[$sectionKey])
        <h2>{{ $pdfText($title) }}</h2>
        <div class="section-note">{{ $pdfText($report['meta']['locale'] === 'ar' ? 'تفاصيل هذا القسم ضمن النطاق التاريخي المحدد.' : 'Detailed finance section for the selected date range.') }}</div>

        @if (count($rows) === 0)
            <div>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'لا توجد بيانات لهذا القسم.' : 'No data available for this section.') }}</div>
        @elseif ($sectionKey === 'shift_transactions')
            @foreach ($rows as $row)
                <div class="transaction-card">
                    <div class="transaction-card-header">
                        <div class="transaction-title">
                            {{ $pdfText($row['source']) }} {{ $pdfText($row['record_id']) }} · {{ $pdfText($row['item']) }}
                        </div>
                        <div class="transaction-meta">
                            {{ $pdfText($row['transaction_at']) }} · {{ $pdfText($row['shift']) }} · {{ $pdfText($row['handled_by']) }}
                        </div>
                    </div>
                    <table class="transaction-grid">
                        <tr>
                            <td><span class="field-label">{{ $pdfText($headerLabel('member')) }}</span><span class="field-value">{{ $pdfText($row['member']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('staff_on_shift')) }}</span><span class="field-value">{{ $pdfText($row['staff_on_shift']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('shift_time')) }}</span><span class="field-value">{{ $pdfText($row['shift_time']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('payment_method')) }}</span><span class="field-value">{{ $pdfText($row['payment_method']) }}</span></td>
                        </tr>
                        <tr>
                            <td><span class="field-label">{{ $pdfText($headerLabel('booked_amount')) }}</span><span class="field-value">{{ $pdfText($row['booked_amount']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('collected_amount')) }}</span><span class="field-value amount-positive">{{ $pdfText($row['collected_amount']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('expense_amount')) }}</span><span class="field-value amount-negative">{{ $pdfText($row['expense_amount']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('net_cash')) }}</span><span class="field-value">{{ $pdfText($row['net_cash']) }}</span></td>
                        </tr>
                        <tr>
                            <td><span class="field-label">{{ $pdfText($headerLabel('status')) }}</span><span class="field-value">{{ $pdfText($row['status']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('handled_by_role')) }}</span><span class="field-value">{{ $pdfText($row['handled_by_role']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('handled_by_shift')) }}</span><span class="field-value">{{ $pdfText($row['handled_by_shift']) }}</span></td>
                            <td><span class="field-label">{{ $pdfText($headerLabel('date')) }}</span><span class="field-value">{{ $pdfText($row['date']) }}</span></td>
                        </tr>
                        <tr>
                            <td colspan="4"><span class="field-label">{{ $pdfText($headerLabel('details')) }}</span><span class="field-value">{{ $pdfText($row['details']) }}</span></td>
                        </tr>
                    </table>
                </div>
            @endforeach
        @else
            <table class="data {{ count(array_keys($rows[0])) > 10 ? 'compact-table' : '' }}">
                <thead>
                    <tr>
                        @foreach (array_keys($rows[0]) as $header)
                            <th>{{ $pdfText($headerLabel($header)) }}</th>
                        @endforeach
                    </tr>
                </thead>
                <tbody>
                    @foreach ($rows as $row)
                        <tr>
                            @foreach ($row as $cell)
                                <td>{{ $pdfText($cell) }}</td>
                            @endforeach
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    @endforeach
</body>
</html>
