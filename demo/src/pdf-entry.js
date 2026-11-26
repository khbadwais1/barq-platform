// تحويل المستند المعروض إلى ملف PDF حقيقي (A4) يُحفظ على الجهاز — يعمل بدون إنترنت
import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

window.downloadPdf = async function (el, fileName, landscape) {
  const canvas = await toCanvas(el, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: false, style: { boxShadow: "none", margin: "0" }, filter: (n) => !(n.matches && n.matches(".no-pdf,.page-head>.row,.tbl-tools,.pager,.cols-menu")) });
  const pdf = new jsPDF({ orientation: landscape ? "l" : "p", unit: "mm", format: "a4", compress: true });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const pagePx = Math.floor((canvas.width * ph) / pw);
  for (let y = 0, i = 0; y < canvas.height; y += pagePx, i++) {
    const h = Math.min(pagePx, canvas.height - y);
    if (h < 8) break;
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = h;
    part.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (i) pdf.addPage();
    pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pw, (h * pw) / canvas.width);
  }
  pdf.setProperties({ title: fileName, creator: "سقالات البرق" });
  pdf.save(fileName.replace(/[\/:*?"<>|]+/g, "-") + ".pdf");
};
