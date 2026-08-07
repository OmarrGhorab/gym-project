import { barcodeRects, encodeCode128 } from "@/lib/barcode";

/**
 * A scannable Code128 symbol.
 *
 * Rendered at its natural size rather than stretched to the container: a
 * barcode's meaning is carried by bar widths, so scaling the axes independently
 * distorts the ratios a scanner measures. An explicit quiet zone either side is
 * required too — scanners need the clear space, and print stylesheets routinely
 * crop tight-fitting graphics.
 */
export function Barcode({
  value,
  height = 56,
  moduleWidth = 2,
  quietZoneModules = 12,
  showText = true,
  className,
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
  quietZoneModules?: number;
  /** Printed under the bars, for keying in by hand when a badge is too worn. */
  showText?: boolean;
  className?: string;
}) {
  const encoding = encodeCode128(value);

  if (!encoding) {
    return <span className="font-mono text-xs">{value}</span>;
  }

  const totalModules = encoding.bars.length + quietZoneModules * 2;
  const width = totalModules * moduleWidth;
  const fontSize = 13;
  const textBand = showText ? fontSize + 6 : 0;
  const totalHeight = height + textBand;

  return (
    <svg
      aria-label={value}
      className={className}
      role="img"
      viewBox={`0 0 ${width} ${totalHeight}`}
      width={width}
      height={totalHeight}
      // Caps the symbol on narrow screens without distorting the bar ratios.
      style={{ maxWidth: "100%", height: "auto" }}
    >
      {/* Explicit white background: the symbol must stay black-on-white even in dark mode. */}
      <rect width={width} height={totalHeight} fill="#ffffff" />
      {barcodeRects(encoding.bars).map(([x, span]) => (
        <rect
          key={x}
          x={(x + quietZoneModules) * moduleWidth}
          y={0}
          width={span * moduleWidth}
          height={height}
          fill="#000000"
        />
      ))}
      {showText ? (
        <text
          x={width / 2}
          y={totalHeight - 4}
          fill="#000000"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={fontSize}
          letterSpacing={1}
          textAnchor="middle"
        >
          {encoding.text}
        </text>
      ) : null}
    </svg>
  );
}
