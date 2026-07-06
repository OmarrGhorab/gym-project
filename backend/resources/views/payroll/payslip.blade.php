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
            padding: 12px 18px;
            font-size: 12px;
            direction: rtl;
        }
        .page {
            max-width: 1030px;
            margin: auto;
            position: relative;
            page-break-after: avoid;
            page-break-inside: avoid;
        }
        .watermark {
            position: absolute;
            top: 210px;
            left: 70px;
            right: 70px;
            text-align: center;
            font-size: 118px;
            font-weight: 900;
            color: #000;
            opacity: .055;
            z-index: 0;
        }
        .sheet-title {
            text-align: center;
            font-weight: 800;
            font-size: 16px;
            text-decoration: underline;
            margin-bottom: 8px;
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
            padding: 6px 10px;
        }
        .header {
            text-align: right;
            margin-bottom: 18px;
        }
        .brand {
            font-size: 30px;
            font-weight: 900;
            letter-spacing: 1px;
        }
        h1, h2 {
            margin: 0 0 10px;
            text-decoration: underline;
            text-align: center;
        }
        .month {
            font-size: 17px;
            font-weight: bold;
            margin-bottom: 12px;
        }
        .line {
            display: table;
            width: 100%;
            margin: 6px 0;
            font-size: 15px;
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
            padding: 0 7px;
        }
        .highlight {
            background: #e6e6e6;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        th, td {
            border: 1px solid #222;
            padding: 5px 5px;
            text-align: center;
            font-size: 12px;
        }
        th {
            background: #dedede;
        }
        .notes {
            margin-top: 10px;
            line-height: 1.55;
            font-size: 11px;
        }
        .notes ul {
            margin: 4px 0 0;
        }
        .totals {
            background: #efefef;
            font-weight: bold;
        }
        .ltr {
            direction: ltr;
            display: inline-block;
        }
        .salary-table th,
        .salary-table td {
            font-size: 12px;
            height: 24px;
        }
        .salary-table .amount {
            direction: ltr;
            font-weight: 700;
        }
        .salary-table .deduction {
            color: #8a1f1f;
        }
        .salary-table .earning {
            color: #0f5132;
        }
        .salary-table .net-row td {
            background: #dedede;
            font-weight: 900;
            font-size: 14px;
        }
        .small-table th,
        .small-table td {
            font-size: 9px;
            padding: 4px;
        }
        .signature-row {
            display: table;
            width: 100%;
            margin-top: 12px;
            font-weight: 700;
        }
        .signature-cell {
            display: table-cell;
            width: 50%;
            padding-top: 18px;
            border-top: 1px solid #999;
            text-align: center;
        }
        tr,
        table,
        .line,
        .signature-row {
            page-break-inside: avoid;
        }
    </style>
</head>
<body>

@php
    $attendance = $payroll->getRelation('monthAttendance') ?? collect();
    $violations = $payroll->getRelation('attendanceViolations') ?? collect();
    $snapshot = $payroll->attendance_snapshot ?? [];
    $ar = $pdfArabic ?? static fn (?string $text): string => $text ?? '';
    $grossSalary = (float) $payroll->base_salary + (float) $payroll->commissions_total + (float) $payroll->bonuses;
    $totalDeductions = (float) $payroll->deductions + (float) $payroll->attendance_deductions;
@endphp

<div class="page">
    <div class="watermark">ATP GYM</div>
    <div class="sheet-title">Fitness studio</div>
    <div class="grid">
        <div class="col">
            <h1>{{ $ar('تفاصيل المرتب') }}</h1>
            <table class="salary-table">
                <thead>
                    <tr>
                        <th>{{ $ar('البند') }}</th>
                        <th>{{ $ar('إضافة') }}</th>
                        <th>{{ $ar('خصم') }}</th>
                        <th>{{ $ar('ملاحظات') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{{ $ar('أساسي المرتب') }}</td>
                        <td class="amount earning">{{ number_format((float) $payroll->base_salary, 2) }}</td>
                        <td>-</td>
                        <td>{{ $ar('راتب ثابت') }}</td>
                    </tr>
                    <tr>
                        <td>{{ $ar('العمولات') }}</td>
                        <td class="amount earning">{{ number_format((float) $payroll->commissions_total, 2) }}</td>
                        <td>-</td>
                        <td>{{ $ar('عمولات الشهر') }}</td>
                    </tr>
                    <tr>
                        <td>{{ $ar('بونص / مكافآت') }}</td>
                        <td class="amount earning">{{ number_format((float) $payroll->bonuses, 2) }}</td>
                        <td>-</td>
                        <td>{{ $ar('مكافآت أو حضور يوم إجازة') }}</td>
                    </tr>
                    <tr>
                        <td>{{ $ar('السلف / الخصم اليدوي') }}</td>
                        <td>-</td>
                        <td class="amount deduction">{{ number_format((float) $payroll->deductions, 2) }}</td>
                        <td>{{ $ar('خصم يدوي') }}</td>
                    </tr>
                    <tr>
                        <td>{{ $ar('الخصم طبقا للائحة') }}</td>
                        <td>-</td>
                        <td class="amount deduction">{{ number_format((float) $payroll->attendance_deductions, 2) }}</td>
                        <td>{{ $ar('مخالفات الحضور') }}</td>
                    </tr>
                    <tr class="totals">
                        <td>{{ $ar('الإجمالي قبل الصافي') }}</td>
                        <td class="amount">{{ number_format($grossSalary, 2) }}</td>
                        <td class="amount">{{ number_format($totalDeductions, 2) }}</td>
                        <td></td>
                    </tr>
                    <tr class="net-row">
                        <td colspan="2">{{ $ar('صافي الراتب') }}</td>
                        <td colspan="2" class="amount">{{ number_format((float) $payroll->net_salary, 2) }}</td>
                    </tr>
                </tbody>
            </table>

            <h2>{{ $ar('لائحة المخالفات') }}</h2>
            <table class="small-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>{{ $ar('نوع المخالفة') }}</th>
                        <th>{{ $ar('الجزاء') }}</th>
                        <th>{{ $ar('الحالة') }}</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($violations as $violation)
                        <tr>
                            <td>{{ $loop->iteration }}</td>
                            <td>{{ $ar($violation->rule?->description ?? $violation->rule?->name ?? $violation->type) }}</td>
                            <td><span class="ltr">{{ number_format((float) $violation->deduction_days, 2) }}</span> {{ $ar('يوم') }} / <span class="ltr">{{ number_format((float) $violation->deduction_amount, 2) }}</span></td>
                            <td>{{ $ar(match ($violation->status) {
                                'approved' => 'معتمد',
                                'dismissed' => 'مرفوض',
                                'auto_applied' => 'مطبق تلقائيا',
                                default => 'معلق',
                            }) }}</td>
                        </tr>
                    @endforeach
                    @if((float) $payroll->deductions > 0)
                        <tr>
                            <td>{{ $violations->count() + 1 }}</td>
                            <td>{{ $ar('السلف / الخصم اليدوي') }}</td>
                            <td><span class="ltr">{{ number_format((float) $payroll->deductions, 2) }}</span></td>
                            <td>{{ $ar('مسجل من الإدارة') }}</td>
                        </tr>
                    @endif
                    @if((float) $payroll->bonuses > 0)
                        <tr>
                            <td>{{ $violations->count() + ((float) $payroll->deductions > 0 ? 2 : 1) }}</td>
                            <td>{{ $ar('بونص / مكافآت') }}</td>
                            <td><span class="ltr">{{ number_format((float) $payroll->bonuses, 2) }}</span></td>
                            <td>{{ $ar('إضافة للراتب') }}</td>
                        </tr>
                    @endif
                    @if($violations->isEmpty() && (float) $payroll->deductions <= 0 && (float) $payroll->bonuses <= 0)
                        <tr>
                            <td colspan="4">{{ $ar('لا توجد مخالفات أو تعديلات مسجلة لهذا الشهر') }}</td>
                        </tr>
                    @endif
                    <tr class="totals">
                        <td colspan="2">{{ $ar('إجمالي الخصومات') }}</td>
                        <td colspan="2">{{ number_format((float) $payroll->attendance_deductions + (float) $payroll->deductions, 2) }}</td>
                    </tr>
                </tbody>
            </table>
            <div class="signature-row">
                <div class="signature-cell">{{ $ar('توقيع الموظف') }}</div>
                <div class="signature-cell">{{ $ar('توقيع الإدارة') }}</div>
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
            <div class="notes">
                <strong>{{ $ar('تنبيه:') }}</strong>
                <ul>
                    <li>{{ $ar('الخصم اليدوي منفصل عن خصم لائحة الحضور.') }}</li>
                    <li>{{ $ar('صافي الراتب يحسب بعد إضافة البونص والعمولات وخصم السلف واللائحة.') }}</li>
                    <li>{{ $ar('المخالفات المعتمدة تظهر في جدول التفاصيل.') }}</li>
                </ul>
            </div>
        </div>
    </div>
</div>

</body>
</html>
