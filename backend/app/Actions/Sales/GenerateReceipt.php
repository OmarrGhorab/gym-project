<?php

namespace App\Actions\Sales;

use App\Models\Sale;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class GenerateReceipt
{
    /**
     * Generate HTML or PDF receipt for a sale.
     */
    public function execute(Sale $sale, string $acceptHeader): Response
    {
        try {
            $sale->load(['items.product', 'soldBy', 'member']);

            if (str_contains($acceptHeader, 'application/pdf')) {
                $pdf = Pdf::loadView('receipts.sale', [
                    'sale' => $sale,
                ]);

                return response($pdf->output(), 200, [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => "inline; filename=\"receipt-{$sale->id}.pdf\"",
                ]);
            }

            return response()->view('receipts.sale', [
                'sale' => $sale,
            ]);
        } catch (\Throwable $e) {
            Log::error('Receipt generation failed: '.$e->getMessage(), [
                'exception' => $e,
                'sale_id' => $sale->id,
            ]);

            abort(500, 'Receipt generation failed.');
        }
    }
}
