@php
    // Falls back to a pass-through so the view still renders if it is ever
    // loaded without the reshaper — a broken glyph beats a fatal error.
    $ar = $pdfArabic ?? static fn (?string $text): string => $text ?? '';
    $money = static fn ($value): string => number_format((float) $value, 2);
    $money_ = $money;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Daily report — {{ $report['business_date'] }}</title>
    <style>
        @page { margin: 18px 20px; }

        body { font-family: 'DejaVu Sans', sans-serif; font-size: 9px; color: #111827; margin: 0; }

        .header { border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 12px; }
        .brand { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
        .title { font-size: 12px; margin-top: 2px; }
        .date { font-size: 10px; color: #4b5563; }

        h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151;
             margin: 14px 0 5px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; }

        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; text-align: left; padding: 4px 6px; font-size: 8px;
             text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #d1d5db; }
        td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .muted { color: #6b7280; }

        .cards { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin-bottom: 4px; }
        .card { border: 1px solid #d1d5db; border-radius: 4px; padding: 6px 8px; width: 25%; }
        .card .label { font-size: 8px; text-transform: uppercase; color: #6b7280; }
        .card .value { font-size: 13px; font-weight: bold; margin-top: 2px; }

        .empty { color: #6b7280; font-style: italic; padding: 6px 0; }
        .foot { margin-top: 14px; border-top: 1px solid #d1d5db; padding-top: 5px;
                font-size: 8px; color: #6b7280; }
    </style>
</head>
<body>
<div class="header">
    <div class="brand">{{ $ar(config('app.gym_name', 'ATP GYM')) }}</div>
    <div class="title">Daily report</div>
    <div class="date">
        Working day {{ $report['business_date'] }}
        · {{ \Illuminate\Support\Carbon::parse($report['window']['from'])->format('D j M H:i') }}
        to {{ \Illuminate\Support\Carbon::parse($report['window']['to'])->format('H:i') }}
    </div>
</div>

<table class="cards">
    <tr>
        <td class="card">
            <div class="label">Collected</div>
            <div class="value">{{ $money($report['money']['collections']) }}</div>
        </td>
        <td class="card">
            <div class="label">Expenses</div>
            <div class="value">{{ $money($report['money']['expenses']) }}</div>
        </td>
        <td class="card">
            <div class="label">Net</div>
            <div class="value">{{ $money($report['money']['net']) }}</div>
        </td>
        <td class="card">
            <div class="label">Refunds</div>
            <div class="value">{{ $money($report['money']['refunds']) }}</div>
        </td>
    </tr>
</table>

<h2>Money by method and source</h2>
<table>
    <thead>
    <tr>
        <th>Cash</th><th>Card</th><th>Bank</th>
        <th>Subscriptions</th><th>Extra plans</th><th>Shop</th><th>Other</th>
    </tr>
    </thead>
    <tbody>
    <tr>
        <td class="num">{{ $money($report['money']['by_method']['cash']) }}</td>
        <td class="num">{{ $money($report['money']['by_method']['card']) }}</td>
        <td class="num">{{ $money($report['money']['by_method']['bank']) }}</td>
        <td class="num">{{ $money($report['money']['by_source']['subscriptions']) }}</td>
        <td class="num">{{ $money($report['money']['by_source']['addons']) }}</td>
        <td class="num">{{ $money($report['money']['by_source']['pos']) }}</td>
        <td class="num">{{ $money($report['money']['by_source']['other']) }}</td>
    </tr>
    </tbody>
</table>

<h2>Who handled the money</h2>
@if (count($report['by_staff']) === 0)
    <div class="empty">No money was taken or spent on this day.</div>
@else
    <table>
        <thead>
        <tr>
            <th>Staff</th>
            <th class="num">Collected</th>
            <th class="num">Payments</th>
            <th class="num">Spent</th>
            <th class="num">Expenses</th>
        </tr>
        </thead>
        <tbody>
        @foreach ($report['by_staff'] as $row)
            <tr>
                <td>{{ $ar($row['name']) }}</td>
                <td class="num">{{ $money($row['collected']) }}</td>
                <td class="num">{{ $row['payment_count'] }}</td>
                <td class="num">{{ $money($row['spent']) }}</td>
                <td class="num">{{ $row['expense_count'] }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2>Shifts</h2>
@if (count($report['shifts']) === 0)
    <div class="empty">No shift was opened on this day.</div>
@else
    <table>
        <thead>
        <tr>
            <th>Shift</th><th>Staff on duty</th><th>Opened</th><th>Closed</th><th>Status</th>
            <th class="num">Opening float</th><th class="num">Expected cash</th>
            <th class="num">Counted</th><th class="num">Variance</th>
        </tr>
        </thead>
        <tbody>
        @foreach ($report['shifts'] as $shift)
            <tr>
                <td>{{ $ar($shift['shift'] ?? '—') }}</td>
                <td>{{ $ar($shift['staff']) }}</td>
                <td>{{ $shift['opened_at'] ?? '—' }}</td>
                <td>{{ $shift['closed_at'] ?? '—' }}</td>
                <td>{{ str_replace('_', ' ', $shift['status']) }}</td>
                <td class="num">{{ $money($shift['opening_float']) }}</td>
                <td class="num">{{ $shift['expected_cash'] !== null ? $money($shift['expected_cash']) : '—' }}</td>
                <td class="num">{{ $shift['counted_cash'] !== null ? $money($shift['counted_cash']) : '—' }}</td>
                <td class="num">{{ $shift['variance'] !== null ? $money($shift['variance']) : '—' }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2>Staff attendance</h2>
<div class="muted" style="margin-bottom:4px;">
    {{ $report['attendance']['totals']['present'] }} present ·
    {{ $report['attendance']['totals']['absent'] }} absent ·
    {{ $report['attendance']['totals']['late'] }} late ·
    {{ $report['attendance']['totals']['no_scan'] }} never scanned ·
    {{ $report['attendance']['totals']['still_in'] }} not signed out
</div>
@if (count($report['attendance']['rows']) === 0)
    <div class="empty">No active staff on record.</div>
@else
    <table>
        <thead>
        <tr><th>Employee</th><th>Role</th><th>Shift</th><th>In</th><th>Out</th><th>Status</th><th>Notes</th></tr>
        </thead>
        <tbody>
        @foreach ($report['attendance']['rows'] as $row)
            <tr>
                <td>{{ $ar($row['name']) }}</td>
                <td>{{ $ar($row['role'] ?? '—') }}</td>
                <td>{{ $ar($row['shift'] ?? '—') }}</td>
                <td>{{ $row['check_in'] ?? '—' }}</td>
                <td>{{ $row['check_out'] ?? '—' }}</td>
                <td>{{ str_replace('_', ' ', $row['status']) }}</td>
                <td>{{ $ar($row['notes'] ?? '') }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2>Memberships sold ({{ $report['memberships']['count'] }})</h2>
@if ($report['memberships']['count'] === 0)
    <div class="empty">No membership was sold on this day.</div>
@else
    <table>
        <thead>
        <tr><th>Time</th><th>Member</th><th>Plan</th><th class="num">Price</th><th>Sold by</th></tr>
        </thead>
        <tbody>
        @foreach ($report['memberships']['rows'] as $row)
            <tr>
                <td>{{ $row['time'] ?? '—' }}</td>
                <td>{{ $ar($row['member'] ?? '—') }}</td>
                <td>{{ $ar($row['plan'] ?? '—') }}</td>
                <td class="num">{{ $money($row['price']) }}</td>
                <td>{{ $ar($row['sold_by']) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2>Expenses ({{ $report['money']['expense_count'] }})</h2>
@if (count($report['expenses']) === 0)
    <div class="empty">Nothing was spent on this day.</div>
@else
    <table>
        <thead>
        <tr><th>Time</th><th>Category</th><th>Description</th><th class="num">Amount</th><th>Recorded by</th></tr>
        </thead>
        <tbody>
        @foreach ($report['expenses'] as $row)
            <tr>
                <td>{{ $row['time'] ?? '—' }}</td>
                <td>{{ $ar($row['category'] ?? '—') }}</td>
                <td>{{ $ar($row['description'] ?? '—') }}</td>
                <td class="num">{{ $money($row['amount']) }}</td>
                <td>{{ $ar($row['recorded_by']) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2>Payments ({{ $report['money']['payment_count'] }})</h2>
@if (count($report['payments']) === 0)
    <div class="empty">No payment was taken on this day.</div>
@else
    <table>
        <thead>
        <tr><th>Time</th><th>Source</th><th>Method</th><th class="num">Amount</th><th>Shift</th><th>Recorded by</th></tr>
        </thead>
        <tbody>
        @foreach ($report['payments'] as $row)
            <tr>
                <td>{{ $row['time'] ?? '—' }}</td>
                <td>{{ $row['source'] }}</td>
                <td>{{ $row['method'] }}</td>
                <td class="num">{{ $money($row['amount']) }}</td>
                <td>{{ $ar($row['shift'] ?? '—') }}</td>
                <td>{{ $ar($row['recorded_by']) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<div class="foot">
    Generated {{ now()->format('D j M Y H:i') }} · figures rebuilt from the ledger, not a stored copy.
</div>
</body>
</html>
