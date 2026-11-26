// يجمع نسخة العرض في ملف HTML واحد يعمل بدون إنترنت أو خادم
import { readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const qr = await build({ entryPoints: ["src/qr-entry.js"], bundle: true, minify: true, format: "iife", write: false, nodePaths: ["../node_modules"] });
const pdf = await build({ entryPoints: ["src/pdf-entry.js"], bundle: true, minify: true, format: "iife", write: false, nodePaths: ["../node_modules"], external: ["html2canvas", "dompurify", "canvg"], logLevel: "error" });
const files = ["data", "logic", "seed", "ui", "app", "pages-core", "pages-sales", "pages-rentals", "pages-customers", "pages-finance", "pages-admin", "pages-print", "pages-reports", "acceptance"];
const js = files.map((f) => `/* ── ${f}.js ── */\n` + readFileSync(`src/${f}.js`, "utf8")).join("\n");
// الخط مضمّن داخل الملف حتى يظهر بشكل صحيح بدون إنترنت
const fontCss = readFileSync("fonts/plex-subset.css", "utf8").replace(/url\((https:[^)]+\/([^/)]+\.woff2))\)/g, (_, u, f) => `url(data:font/woff2;base64,${readFileSync("fonts/" + f).toString("base64")})`);
const css = fontCss + readFileSync("src/styles.css", "utf8");
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سقالات البرق — نسخة العرض</title>
<meta name="description" content="نظام بيع وتأجير السقالات لمؤسسة سقالات البرق: البيع والإيجار والمخزون والعهد والفواتير والتحصيل ولوحات المالك والمالية والبائع.">
<meta name="application-name" content="سقالات البرق">
<meta name="theme-color" content="#14266b">
<meta name="robots" content="noindex">
<meta property="og:title" content="سقالات البرق — نظام البيع والتأجير">
<meta property="og:description" content="نسخة عرض للمراجعة: من البائع إلى الفاتورة والتحصيل ولوحة المالك.">
<meta property="og:locale" content="ar_SA">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2314266b'/%3E%3Ctext x='32' y='45' text-anchor='middle' font-family='Georgia,serif' font-weight='700' font-size='40' fill='%23fff'%3EB%3C/text%3E%3C/svg%3E">
<style>${css}</style>
</head>
<body>
<div id="root"></div><div id="modal-root"></div><div class="toasts" id="toasts"></div>
<script>${qr.outputFiles[0].text}</script>
<script>${pdf.outputFiles[0].text}</script>
<script>
${js}
/* ── التشغيل ── */
load();
render();
setInterval(() => { if (ME && !UI.modal && document.visibilityState === "visible" && !document.activeElement?.matches("input,textarea,select")) render(); }, 20000);
</script>
</body>
</html>`;
writeFileSync("barq-demo.html", html);
console.log("barq-demo.html", (html.length / 1024).toFixed(0) + " KB");
