// خادم ثابت صغير لمعاينة نسخة العرض محليًا
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const port = Number(process.env.PORT || 5180);
createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(readFileSync(new URL("./barq-demo.html", import.meta.url)));
}).listen(port, () => console.log("demo on http://localhost:" + port));
