import { barcodeRects, encodeCode128 } from "@/lib/barcode";

/**
 * A scannable Code128 symbol.
 *
 * Rendered as pure SVG with an explicit quiet zone — scanners need clear space
 * either side of the symbol or they will not read it, and print stylesheets
 * routinely crop tight-fitting graphics.
 */
export function Barcode({
  value,
  height = 56,
  moduleWidth = 2,
  quietZoneModules = 12,
  className,
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
  quietZoneModules?: number;
  className?: string;
}) {
  const encoding = encodeCode128(value);

  if (!encoding) {
    return <span className="font-mono text-xs">{value}</span>;
  }

  const totalModules = encoding.bars.length + quietZoneModules * 2;
  const width = totalModules * moduleWidth;

  return (
    <svg
      aria-label={value}
      className={className}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
    >
      {/* Explicit white background: the symbol must stay black-on-white even in dark mode. */}
      <rect width={width} height={height} fill="#ffffff" />
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
    </svg>
  );
}
