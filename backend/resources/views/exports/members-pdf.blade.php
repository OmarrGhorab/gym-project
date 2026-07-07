<!DOCTYPE html>
<html lang="{{ $isRtl ? 'ar' : 'en' }}" dir="{{ $isRtl ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 11px;
            color: #111827;
            direction: {{ $isRtl ? 'rtl' : 'ltr' }};
        }

        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        th, td {
            border: 1px solid #d1d5db;
            padding: 6px 8px;
            text-align: {{ $isRtl ? 'right' : 'left' }};
            vertical-align: top;
            word-wrap: break-word;
        }

        th {
            background: #f3f4f6;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
                @foreach ($columns as $column)
                    <th>{{ $isRtl ? $pdfArabic($column) : $column }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    @foreach ($row as $cell)
                        <td>{{ $isRtl && is_string($cell) ? $pdfArabic($cell) : $cell }}</td>
                    @endforeach
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
