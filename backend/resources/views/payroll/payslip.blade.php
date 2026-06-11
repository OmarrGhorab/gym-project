<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Payslip - {{ $payroll->month }}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 20px;
            font-size: 14px;
        }
        .payslip-box {
            max-width: 600px;
            margin: auto;
            padding: 30px;
            border: 1px solid #eee;
            background: #fff;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
        }
        .company-name {
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .title {
            font-size: 16px;
            color: #555;
            margin-top: 5px;
        }
        .details-table, .earnings-table {
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
        }
        .details-table td {
            padding: 5px 0;
            font-size: 13px;
        }
        .details-table td.right {
            text-align: right;
            font-weight: bold;
        }
        .earnings-header {
            background: #f5f5f5;
            font-weight: bold;
            border-bottom: 1px solid #ddd;
        }
        .earnings-table th {
            text-align: left;
            padding: 8px;
            font-size: 12px;
            text-transform: uppercase;
        }
        .earnings-table td {
            padding: 10px 8px;
            border-bottom: 1px solid #eee;
            font-size: 13px;
        }
        .earnings-table td.right {
            text-align: right;
        }
        .net-salary-row {
            font-size: 16px;
            font-weight: bold;
            background: #f9f9f9;
        }
        .net-salary-row td {
            border-top: 2px solid #333;
            padding: 12px 8px;
        }
    </style>
</head>
<body>

<div class="payslip-box">
    <div class="header">
        <div class="company-name">Gym Platform</div>
        <div class="title">Employee Payslip</div>
    </div>

    <table class="details-table">
        <tr>
            <td>Employee Name:</td>
            <td class="right">{{ $payroll->employee?->name }}</td>
        </tr>
        <tr>
            <td>Role:</td>
            <td class="right">{{ ucfirst($payroll->employee?->role) }}</td>
        </tr>
        <tr>
            <td>Pay Period / Month:</td>
            <td class="right">{{ $payroll->month }}</td>
        </tr>
        <tr>
            <td>Status:</td>
            <td class="right">{{ strtoupper($payroll->status) }}</td>
        </tr>
        @if($payroll->paid_at)
            <tr>
                <td>Paid Date:</td>
                <td class="right">{{ $payroll->paid_at->format('Y-m-d H:i:s') }}</td>
            </tr>
        @endif
    </table>

    <table class="earnings-table">
        <thead>
            <tr class="earnings-header">
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Base Salary</td>
                <td class="right">{{ number_format((float) $payroll->base_salary, 2) }}</td>
            </tr>
            <tr>
                <td>Commissions Earned</td>
                <td class="right">{{ number_format((float) $payroll->commissions_total, 2) }}</td>
            </tr>
            <tr>
                <td>Bonuses</td>
                <td class="right">{{ number_format((float) $payroll->bonuses, 2) }}</td>
            </tr>
            <tr>
                <td>Deductions</td>
                <td class="right">-{{ number_format((float) $payroll->deductions, 2) }}</td>
            </tr>
            <tr class="net-salary-row">
                <td>Net Pay</td>
                <td class="right">{{ number_format((float) $payroll->net_salary, 2) }}</td>
            </tr>
        </tbody>
    </table>
</div>

</body>
</html>
