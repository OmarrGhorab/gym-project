<!DOCTYPE html>
<html lang="{{ $isRtl ? 'ar' : 'en' }}" dir="{{ $isRtl ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="utf-8">
    <title>Finance Report</title>
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
    <h1>{{ $pdfText('Gym Finance Report') }}</h1>

    <div class="meta">
        <div>{{ $pdfText('Generated at') }}: {{ $pdfText($report['meta']['generated_at']) }}</div>
        <div>{{ $pdfText('From') }}: {{ $pdfText($report['meta']['from']) }}</div>
        <div>{{ $pdfText('To') }}: {{ $pdfText($report['meta']['to']) }}</div>
    </div>

    <div class="summary">
        <h2>{{ $pdfText('Summary') }}</h2>
        <table class="summary-grid">
            <thead>
                <tr>
                    <th>{{ $pdfText('Metric') }}</th>
                    <th>{{ $pdfText('Value') }}</th>
                </tr>
            </thead>
            <tbody>
                @foreach ([
                    'Collected revenue total' => $report['summary']['collected_revenue_total'],
                    'Subscription revenue collected' => $report['summary']['subscription_revenue_collected'],
                    'Add-on revenue collected' => $report['summary']['addon_revenue_collected'],
                    'POS revenue collected' => $report['summary']['pos_revenue_collected'],
                    'Other revenue collected' => $report['summary']['other_revenue_collected'],
                    'Booked subscriptions total' => $report['summary']['booked_subscriptions_total'],
                    'Booked add-ons total' => $report['summary']['booked_addons_total'],
                    'POS gross sales total' => $report['summary']['pos_gross_sales_total'],
                    'Expenses total' => $report['summary']['expenses_total'],
                    'Pending payroll total' => $report['summary']['pending_payroll_total'],
                    'Paid payroll total' => $report['summary']['paid_payroll_total'],
                    'Salary snapshot total' => $report['summary']['salary_snapshot_total'],
                    'Outstanding dues total' => $report['summary']['outstanding_dues_total'],
                    'Net profit after expenses' => $report['summary']['net_profit_after_expenses'],
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
        'Subscriptions' => $report['subscriptions'],
        'Add-ons' => $report['addons'],
        'POS Sales' => $report['sales'],
        'Payments' => $report['payments'],
        'Payroll' => $report['payroll'],
        'Salaries' => $report['salaries'],
        'Expenses' => $report['expenses'],
        'Expense Categories' => $report['expenses_by_category'],
        'Outstanding Dues' => $report['dues'],
    ] as $title => $rows)
        <h2>{{ $pdfText($title) }}</h2>
        <div class="section-note">{{ $pdfText('Detailed finance section for the selected date range.') }}</div>

        @if (count($rows) === 0)
            <div>{{ $pdfText('No data available for this section.') }}</div>
        @else
            <table class="data">
                <thead>
                    <tr>
                        @foreach (array_keys($rows[0]) as $header)
                            <th>{{ $pdfText(\Illuminate\Support\Str::headline(str_replace('_', ' ', $header))) }}</th>
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
