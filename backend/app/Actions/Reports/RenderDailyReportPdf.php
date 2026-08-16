<?php

namespace App\Actions\Reports;

use ArPHP\I18N\Arabic;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * The day's report as a printable document.
 *
 * Arabic is reshaped before it reaches dompdf, which has no bidi engine of its
 * own and would otherwise render member and staff names as disconnected letters
 * in the wrong order.
 */
class RenderDailyReportPdf
{
    /**
     * @param  array<string, mixed>  $report
     */
    public function handle(array $report): string
    {
        $arabic = new Arabic;

        return Pdf::loadView('reports.daily-report-pdf', [
            'pdfArabic' => static fn (?string $text): string => $text !== null && $text !== ''
                ? $arabic->utf8Glyphs($text, 120, false, true)
                : '',
            'report' => $report,
        ])
            ->setPaper('a4', 'portrait')
            ->setOption('defaultFont', 'DejaVu Sans')
            ->setOption('isHtml5ParserEnabled', true)
            ->output();
    }

    public function filename(string $businessDate): string
    {
        return "daily-report-{$businessDate}.pdf";
    }
}
