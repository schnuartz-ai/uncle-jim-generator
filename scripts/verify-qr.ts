import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
const reports=JSON.parse(await readFile('output/qa/qr-manifest.json','utf8'));
let count=0;
for(const report of reports) for(const item of report.qrs){
  const rgba=new Uint8ClampedArray(await readFile(item.file));
  const decoded=jsQR(rgba,item.width,item.height);
  if(decoded?.data!==item.expected)throw new Error(`QR decode mismatch: ${report.fixture}/${item.file}`);
  count++;
}
console.log(`${count} QR codes decoded correctly from rendered 300 dpi PDFs.`);
