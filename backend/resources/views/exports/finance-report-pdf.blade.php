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
            table-layout: fixed;
            margin-top: 8px;
        }
        .section-note {
            color: #6b7280;
            font-size: 10px;
            margin-top: 2px;
            text-align: {{ $isRtl ? 'right' : 'left' }};
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

    @foreach ([
        ($report['meta']['locale'] === 'ar' ? 'الاشتراكات' : 'Subscriptions') => $report['subscriptions'],
        ($report['meta']['locale'] === 'ar' ? 'الإضافات' : 'Add-ons') => $report['addons'],
        ($report['meta']['locale'] === 'ar' ? 'مبيعات نقطة البيع' : 'POS Sales') => $report['sales'],
        ($report['meta']['locale'] === 'ar' ? 'المدفوعات' : 'Payments') => $report['payments'],
        ($report['meta']['locale'] === 'ar' ? 'الرواتب' : 'Payroll') => $report['payroll'],
        ($report['meta']['locale'] === 'ar' ? 'المرتبات' : 'Salaries') => $report['salaries'],
        ($report['meta']['locale'] === 'ar' ? 'المصروفات' : 'Expenses') => $report['expenses'],
        ($report['meta']['locale'] === 'ar' ? 'فئات المصروفات' : 'Expense Categories') => $report['expenses_by_category'],
        ($report['meta']['locale'] === 'ar' ? 'المستحقات' : 'Outstanding Dues') => $report['dues'],
    ] as $title => $rows)
        <h2>{{ $pdfText($title) }}</h2>
        <div class="section-note">{{ $pdfText($report['meta']['locale'] === 'ar' ? 'تفاصيل هذا القسم ضمن النطاق التاريخي المحدد.' : 'Detailed finance section for the selected date range.') }}</div>

        @if (count($rows) === 0)
            <div>{{ $pdfText($report['meta']['locale'] === 'ar' ? 'لا توجد بيانات لهذا القسم.' : 'No data available for this section.') }}</div>
        @else
            <table class="data">
                <thead>
                    <tr>
                        @foreach (array_keys($rows[0]) as $header)
                            <th>{{ $pdfText(match ($header) {
                                'addon_id' => $report['meta']['locale'] === 'ar' ? 'رقم الإضافة' : 'Add-on ID',
                                'amount' => $report['meta']['locale'] === 'ar' ? 'المبلغ' : 'Amount',
                                'attendance_deductions' => $report['meta']['locale'] === 'ar' ? 'خصومات الحضور' : 'Attendance deductions',
                                'balance' => $report['meta']['locale'] === 'ar' ? 'الرصيد' : 'Balance',
                                'base_salary' => $report['meta']['locale'] === 'ar' ? 'الراتب الأساسي' : 'Base salary',
                                'booked_price' => $report['meta']['locale'] === 'ar' ? 'القيمة المسجلة' : 'Booked price',
                                'booked_total' => $report['meta']['locale'] === 'ar' ? 'الإجمالي المسجل' : 'Booked total',
                                'bonuses' => $report['meta']['locale'] === 'ar' ? 'المكافآت' : 'Bonuses',
                                'category' => $report['meta']['locale'] === 'ar' ? 'الفئة' : 'Category',
                                'coach' => $report['meta']['locale'] === 'ar' ? 'المدرب' : 'Coach',
                                'collected' => $report['meta']['locale'] === 'ar' ? 'المحصل' : 'Collected',
                                'commission_rate' => $report['meta']['locale'] === 'ar' ? 'نسبة العمولة' : 'Commission rate',
                                'commissions_total' => $report['meta']['locale'] === 'ar' ? 'إجمالي العمولات' : 'Commissions total',
                                'created_at' => $report['meta']['locale'] === 'ar' ? 'تاريخ الإنشاء' : 'Created at',
                                'created_by' => $report['meta']['locale'] === 'ar' ? 'أضيف بواسطة' : 'Created by',
                                'date' => $report['meta']['locale'] === 'ar' ? 'التاريخ' : 'Date',
                                'deductions' => $report['meta']['locale'] === 'ar' ? 'الخصومات' : 'Deductions',
                                'description' => $report['meta']['locale'] === 'ar' ? 'الوصف' : 'Description',
                                'employee' => $report['meta']['locale'] === 'ar' ? 'الموظف' : 'Employee',
                                'employee_id' => $report['meta']['locale'] === 'ar' ? 'رقم الموظف' : 'Employee ID',
                                'end_date' => $report['meta']['locale'] === 'ar' ? 'تاريخ الانتهاء' : 'End date',
                                'entries' => $report['meta']['locale'] === 'ar' ? 'عدد البنود' : 'Entries',
                                'hire_date' => $report['meta']['locale'] === 'ar' ? 'تاريخ التعيين' : 'Hire date',
                                'item' => $report['meta']['locale'] === 'ar' ? 'البند' : 'Item',
                                'items' => $report['meta']['locale'] === 'ar' ? 'العناصر' : 'Items',
                                'member' => $report['meta']['locale'] === 'ar' ? 'العضو' : 'Member',
                                'method' => $report['meta']['locale'] === 'ar' ? 'الطريقة' : 'Method',
                                'month' => $report['meta']['locale'] === 'ar' ? 'الشهر' : 'Month',
                                'net_salary' => $report['meta']['locale'] === 'ar' ? 'صافي الراتب' : 'Net salary',
                                'paid_at' => $report['meta']['locale'] === 'ar' ? 'تاريخ الدفع' : 'Paid at',
                                'pay_day' => $report['meta']['locale'] === 'ar' ? 'يوم الصرف' : 'Pay day',
                                'payment_id' => $report['meta']['locale'] === 'ar' ? 'رقم الدفعة' : 'Payment ID',
                                'payroll_id' => $report['meta']['locale'] === 'ar' ? 'رقم الرواتب' : 'Payroll ID',
                                'plan' => $report['meta']['locale'] === 'ar' ? 'الخطة' : 'Plan',
                                'role' => $report['meta']['locale'] === 'ar' ? 'الدور' : 'Role',
                                'sale_id' => $report['meta']['locale'] === 'ar' ? 'رقم البيع' : 'Sale ID',
                                'seller' => $report['meta']['locale'] === 'ar' ? 'البائع' : 'Seller',
                                'service' => $report['meta']['locale'] === 'ar' ? 'الخدمة' : 'Service',
                                'shift' => $report['meta']['locale'] === 'ar' ? 'الشيفت' : 'Shift',
                                'sold_at' => $report['meta']['locale'] === 'ar' ? 'تاريخ البيع' : 'Sold at',
                                'sold_by' => $report['meta']['locale'] === 'ar' ? 'تم البيع بواسطة' : 'Sold by',
                                'source' => $report['meta']['locale'] === 'ar' ? 'المصدر' : 'Source',
                                'start_date' => $report['meta']['locale'] === 'ar' ? 'تاريخ البدء' : 'Start date',
                                'status' => $report['meta']['locale'] === 'ar' ? 'الحالة' : 'Status',
                                'subscription_id' => $report['meta']['locale'] === 'ar' ? 'رقم الاشتراك' : 'Subscription ID',
                                'subtotal' => $report['meta']['locale'] === 'ar' ? 'الإجمالي قبل الخصم' : 'Subtotal',
                                'total' => $report['meta']['locale'] === 'ar' ? 'الإجمالي' : 'Total',
                                'type' => $report['meta']['locale'] === 'ar' ? 'النوع' : 'Type',
                                default => \Illuminate\Support\Str::headline(str_replace('_', ' ', $header)),
                            }) }}</th>
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
