<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Salary Receipt - {{ $payroll->month }}</title>
    <style>
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            color: #111;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            direction: rtl;
        }
        .page {
            max-width: 980px;
            margin: auto;
            position: relative;
        }
        .watermark {
            position: absolute;
            inset: 160px 120px auto 120px;
            text-align: center;
            font-size: 96px;
            font-weight: 900;
            color: #000;
            opacity: .08;
            z-index: 0;
        }
        .grid {
            display: table;
            width: 100%;
            table-layout: fixed;
            position: relative;
            z-index: 1;
        }
        .col {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding: 10px;
        }
        .header {
            text-align: right;
            margin-bottom: 26px;
        }
        .brand {
            font-size: 32px;
            font-weight: 900;
            letter-spacing: 1px;
        }
        h1, h2 {
            margin: 0 0 18px;
            text-decoration: underline;
            text-align: center;
        }
        .month {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 18px;
        }
        .line {
            display: table;
            width: 100%;
            margin: 12px 0;
            font-size: 16px;
        }
        .label {
            display: table-cell;
            width: 42%;
            font-weight: bold;
        }
        .value {
            display: table-cell;
            border-bottom: 1px solid #ddd;
            min-height: 20px;
            padding: 0 8px;
        }
        .highlight {
            background: #e6e6e6;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        th, td {
            border: 1px solid #222;
            padding: 6px;
            text-align: center;
            font-size: 11px;
        }
        th {
            background: #dedede;
        }
        .notes {
            margin-top: 16px;
            line-height: 1.8;
            font-size: 13px;
        }
        .totals {
            background: #efefef;
            font-weight: bold;
        }
        .ltr {
            direction: ltr;
            display: inline-block;
        }
    </style>
</head>
<body>

@php
    $attendance = $payroll->getRelation('monthAttendance') ?? collect();
    $violations = $payroll->getRelation('attendanceViolations') ?? collect();
    $snapshot = $payroll->attendance_snapshot ?? [];
    $ar = $pdfArabic ?? static fn (?string $text): string => $text ?? '';
@endphp

<div class="page">
    <div class="watermark">ATP GYM</div>
    <div class="grid">
        <div class="col">
            <h1>{{ $ar('لائحة المخالفات') }}</h1>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>{{ $ar('نوع المخالفة') }}</th>
                        <th>{{ $ar('الجزاء') }}</th>
                        <th>{{ $ar('الحالة') }}</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($violations as $violation)
                        <tr>
                            <td>{{ $loop->iteration }}</td>
                            <td>{{ $ar($violation->rule?->description ?? $violation->type) }}</td>
                            <td><span class="ltr">{{ number_format((float) $violation->deduction_days, 2) }}</span> {{ $ar('يوم') }} / <span class="ltr">{{ number_format((float) $violation->deduction_amount, 2) }}</span></td>
                            <td>{{ $ar($violation->status) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4">{{ $ar('لا توجد مخالفات مسجلة لهذا الشهر') }}</td>
                        </tr>
                    @endforelse
                    <tr class="totals">
                        <td colspan="2">{{ $ar('الإجمالي') }}</td>
                        <td colspan="2">{{ number_format((float) $payroll->attendance_deductions, 2) }}</td>
                    </tr>
                </tbody>
            </table>
            <div class="notes">
                <strong>{{ $ar('تنبيه:') }}</strong>
                <ul>
                    <li>{{ $ar('هذه اللائحة تتضمن عدم فعل المخالفة وعدم تكرارها.') }}</li>
                    <li>{{ $ar('أي مخالفة معلقة يمكن مراجعتها من الإدارة قبل صرف الراتب.') }}</li>
                    <li>{{ $ar('المخالفات غير المراجعة تطبق تلقائيا حسب إعدادات النظام.') }}</li>
                </ul>
            </div>
        </div>

        <div class="col">
            <div class="header">
                <div class="brand">ATP GYM</div>
                <div>Unleash Your Energy</div>
            </div>
            <div class="month">{{ $ar('مرتبات شهر') }} / <span class="ltr">{{ $payroll->month }}</span></div>
            <h2>{{ $ar('البيانات الشخصية') }}</h2>
            <div class="line"><span class="label">{{ $ar('الاسم :') }}</span><span class="value">{{ $ar($payroll->employee?->name) }}</span></div>
            <div class="line"><span class="label">{{ $ar('الوظيفة :') }}</span><span class="value">{{ $ar($payroll->employee?->role) }}</span></div>
            <div class="line"><span class="label">{{ $ar('نظام العمل :') }}</span><span class="value">{{ $ar($payroll->employee?->shift?->name ?? '-') }}</span></div>
            <div class="line"><span class="label">{{ $ar('أساسي المرتب :') }}</span><span class="value">{{ number_format((float) $payroll->base_salary, 2) }}</span></div>
            <div class="line"><span class="label">{{ $ar('العمولات :') }}</span><span class="value">{{ number_format((float) $payroll->commissions_total, 2) }}</span></div>
            <div class="line"><span class="label">{{ $ar('بونص :') }}</span><span class="value">{{ number_format((float) $payroll->bonuses, 2) }}</span></div>
            <div class="line"><span class="label">{{ $ar('أيام الغياب :') }}</span><span class="value">{{ $attendance->where('status', 'absent')->count() }}</span></div>
            <div class="line"><span class="label">{{ $ar('السلف / الخصم اليدوي :') }}</span><span class="value">{{ number_format((float) $payroll->deductions, 2) }}</span></div>
            <div class="line"><span class="label">{{ $ar('الخصم طبقا للائحة :') }}</span><span class="value">{{ number_format((float) $payroll->attendance_deductions, 2) }}</span></div>
            <div class="line highlight"><span class="label">{{ $ar('صافي الراتب :') }}</span><span class="value">{{ number_format((float) $payroll->net_salary, 2) }}</span></div>
            <div class="line"><span class="label">{{ $ar('ملاحظات :') }}</span><span class="value">{{ $ar($snapshot['notes'] ?? '') }}</span></div>
        </div>
    </div>
</div>

</body>
</html>
