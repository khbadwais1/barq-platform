import QRCode from "qrcode/lib/core/qrcode.js";
window.qrSvg = function (text) {
  const q = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = q.modules.size, d = q.modules.data, m = 2;
  let p = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[y * n + x]) p += `M${x + m} ${y + m}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" width="120" height="120" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
};
