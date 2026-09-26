// Preview stand-in for qrcode.react using the MIT QR encoder bundled with npm (Kazuhiko Arase).
// eslint-disable-next-line @typescript-eslint/no-require-imports
import QRCode from "/opt/node22/lib/node_modules/npm/node_modules/qrcode-terminal/vendor/QRCode/index.js";
import ECL from "/opt/node22/lib/node_modules/npm/node_modules/qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel.js";
import { useMemo } from "react";

export function QRCodeSVG({ value, size = 128, level = "M", marginSize = 0, ...rest }: { value: string; size?: number; level?: "L" | "M" | "Q" | "H"; marginSize?: number } & Record<string, unknown>) {
  const { n, path } = useMemo(() => {
    const qr = new QRCode(-1, (ECL as Record<string, number>)[level]);
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c + marginSize} ${r + marginSize}h1v1h-1z`;
    return { n: count + marginSize * 2, path: d };
  }, [value, level, marginSize]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" {...rest}>
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
