<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Daily attendance — {{ $report['business_date'] }}</title>
    <style>
        @page { margin: 18px 20px; }

        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 9px;
            color: #111827;
            margin: 0;
        }

        .header {
            border-bottom: 2px solid #111827;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }

        .brand {
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 1px;
        }

        .title {
            font-size: 12px;
            margin-top: 2px;
        }

        .date {
            font-size: 10px;
            color: #4b5563;
        }

        .totals {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }

        .totals td {
            border: 1px solid #d1d5db;
            padding: 5px 6px;
            text-align: center;
        }

        .totals .label {
            color: #4b5563;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .totals .value {
            font-size: 13px;
            font-weight: bold;
        }

        table.sheet {
            width: 100%;
            border-collapse: collapse;
        }

        table.sheet th {
            background: #111827;
            color: #ffffff;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            padding: 5px 4px;
            text-align: left;
        }

        table.sheet td {
            border-bottom: 1px solid #e5e7eb;
            padding: 4px;
            vertical-align: top;
        }

        table.sheet tr:nth-child(even) td {
            background: #f9fafb;
        }

        .flag {
            font-weight: bold;
        }

        .flag-bad { color: #b91c1c; }
        .flag-ok { color: #15803d; }
        .muted { color: #9ca3af; }

        .footer {
            margin-top: 12px;
            font-size: 8px;
            color: #6b7280;
        }
    </style>
</head>
<body>

@php
    $ar = $pdfArabic ?? static fn (?string $text): string => $text ?? '';
    $totals = $report['totals'];
    $statusLabel = static fn (string $status): string => match ($status) {
        'present' => 'Present',
        'absent' => 'Absent',
        'excused' => 'Excused',
        'no_scan' => 'No scan',
        default => ucfirst(str_replace('_', ' ', $status)),
    };
@endphp

<div class="header">
    <div class="brand">ATP GYM</div>
    <div class="title">Daily staff attendance report</div>
    <div class="date">{{ \Illuminate\Support\Carbon::parse($report['business_date'])->format('l, d F Y') }}</div>
</div>

<table class="totals">
    <tr>
        <td>
            <div class="label">Active staff</div>
            <div class="value">{{ $totals['employees_count'] }}</div>
        </td>
        <td>
            <div class="label">Scanned</div>
            <div class="value">{{ $totals['records_count'] }}</div>
        </td>
        <td>
            <div class="label">Absent</div>
            <div class="value">{{ $totals['absent_count'] }}</div>
        </td>
        <td>
            <div class="label">Still in</div>
            <div class="value">{{ $totals['still_in_count'] }}</div>
        </td>
        <td>
            <div class="label">No scan</div>
            <div class="value">{{ $totals['no_scan_count'] }}</div>
        </td>
    </tr>
</table>

<table class="sheet">
    <thead>
        <tr>
            <th style="width: 4%;">#</th>
            <th style="width: 20%;">Employee</th>
            <th style="width: 12%;">Role</th>
            <th style="width: 14%;">Shift</th>
            <th style="width: 9%;">Check in</th>
            <th style="width: 9%;">Check out</th>
            <th style="width: 8%;">Hours</th>
            <th style="width: 9%;">Status</th>
            <th style="width: 15%;">Notes</th>
        </tr>
    </thead>
    <tbody>
        @forelse($report['rows'] as $row)
            <tr>
                <td>{{ $loop->iteration }}</td>
                <td>{{ $ar($row['employee']) }}</td>
                <td>{{ $ar($row['role']) }}</td>
                <td>{{ $ar($row['shift']) }}</td>
                <td>{{ $row['check_in'] }}</td>
                <td>{{ $row['check_out'] }}</td>
                <td>
                    @if($row['hours'] === '-')
                        <span class="muted">—</span>
                    @else
                        {{ $row['hours'] }}
                    @endif
                </td>
                <td>
                    <span class="flag {{ in_array($row['status'], ['absent', 'no_scan'], true) ? 'flag-bad' : 'flag-ok' }}">
                        {{ $statusLabel($row['status']) }}
                    </span>
                </td>
                <td>{{ $ar($row['notes']) }}</td>
            </tr>
        @empty
            <tr>
                <td colspan="9">No active employees on record for this day.</td>
            </tr>
        @endforelse
    </tbody>
</table>

<div class="footer">
    Generated {{ now()->format('d M Y H:i') }} — times are Africa/Cairo. "No scan" means the employee never badged in on this day; a blank check-out means they had not signed out when this report was built.
</div>

</body>
</html>
