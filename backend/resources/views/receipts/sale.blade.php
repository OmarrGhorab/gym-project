@php
    $vatRate = \App\Models\Setting::where('key', 'vat_rate')->first()?->value ?? 0;
    $currency = \App\Models\Setting::where('key', 'currency_symbol')->first()?->value ?? 'LE';
    
    // Calculate VAT amount if applicable
    $vatAmount = '0.00';
    if ($vatRate > 0) {
        $vatFactor = bcdiv((string) $vatRate, '100', 4);
        $vatAmount = bcmul($sale->total, $vatFactor, 2);
    }
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Receipt #{{ $sale->id }}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 20px;
            font-size: 14px;
            line-height: 1.4;
        }
        .receipt-box {
            max-width: 400px;
            margin: auto;
            padding: 20px;
            border: 1px solid #eee;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
            background: #fff;
        }
        .title {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .subtitle {
            text-align: center;
            font-size: 12px;
            color: #777;
            margin-bottom: 20px;
        }
        .info-table {
            width: 100%;
            margin-bottom: 20px;
            font-size: 12px;
            border-bottom: 1px dashed #ddd;
            padding-bottom: 10px;
        }
        .info-table td {
            padding: 3px 0;
        }
        .info-table td.right {
            text-align: right;
            font-weight: bold;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .items-table th {
            border-bottom: 2px solid #333;
            text-align: left;
            padding: 6px 0;
            font-size: 12px;
            text-transform: uppercase;
        }
        .items-table td {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
            font-size: 13px;
        }
        .items-table td.right {
            text-align: right;
        }
        .totals-table {
            width: 100%;
            margin-top: 10px;
            border-top: 2px solid #333;
            padding-top: 10px;
        }
        .totals-table td {
            padding: 4px 0;
            font-size: 13px;
        }
        .totals-table td.right {
            text-align: right;
            font-weight: bold;
        }
        .totals-table tr.grand-total td {
            font-size: 16px;
            font-weight: bold;
            border-top: 1px dashed #ddd;
            padding-top: 8px;
        }
        .footer-msg {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #777;
            border-top: 1px dashed #ddd;
            padding-top: 15px;
        }
    </style>
</head>
<body>

<div class="receipt-box">
    <div class="title">Gym Retail Store</div>
    <div class="subtitle">Receipt of Purchase</div>

    <table class="info-table">
        <tr>
            <td>Receipt ID:</td>
            <td class="right">#{{ $sale->id }}</td>
        </tr>
        <tr>
            <td>Date:</td>
            <td class="right">{{ $sale->created_at->format('Y-m-d H:i:s') }}</td>
        </tr>
        <tr>
            <td>Cashier:</td>
            <td class="right">{{ $sale->soldBy->name ?? 'N/A' }}</td>
        </tr>
        @if($sale->member)
            <tr>
                <td>Member:</td>
                <td class="right">{{ $sale->member->name }}</td>
            </tr>
        @endif
        <tr>
            <td>Payment Method:</td>
            <td class="right">{{ strtoupper(str_replace('_', ' ', $sale->payment_method)) }}</td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th class="right">Price</th>
                <th class="right">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($sale->items as $item)
                <tr>
                    <td>
                        {{ $item->product->name ?? 'Unknown Product' }}<br>
                        <small style="color: #888;">{{ $item->product->sku ?? '' }}</small>
                    </td>
                    <td style="text-align: center;">{{ $item->quantity }}</td>
                    <td class="right">{{ number_format((float) $item->unit_price, 2) }}</td>
                    <td class="right">{{ number_format((float) $item->total, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals-table">
        <tr>
            <td>Subtotal</td>
            <td class="right">{{ number_format((float) $sale->subtotal, 2) }} {{ $currency }}</td>
        </tr>
        @if(bccomp((string) $sale->discount, '0.00', 2) > 0)
            <tr>
                <td>Discount</td>
                <td class="right">-{{ number_format((float) $sale->discount, 2) }} {{ $currency }}</td>
            </tr>
        @endif
        @if($vatRate > 0)
            <tr>
                <td>VAT ({{ $vatRate }}%)</td>
                <td class="right">{{ number_format((float) $vatAmount, 2) }} {{ $currency }}</td>
            </tr>
        @endif
        <tr class="grand-total">
            <td>Total</td>
            <td class="right">{{ number_format((float) $sale->total, 2) }} {{ $currency }}</td>
        </tr>
    </table>

    <div class="footer-msg">
        Thank you for your purchase!<br>
        Please keep this receipt for your records.
    </div>
</div>

</body>
</html>
