import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.png':'image/png','.json':'application/json'};
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const de=url.pathname.startsWith('/de/');
  let relative=url.pathname.replace(/^\/(?:de\/)?uncle-jim-generator\/?/,'');
  if(!relative)relative=de?'de/index.html':'index.html';
  if(relative==='sw.js'&&de)relative='de/sw.js';
  const path=resolve(root,relative);
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{
    if(!(await stat(path)).isFile())throw Error();
    res.setHeader('Content-Type',types[extname(path)]??'application/octet-stream');
    if(path.endsWith('sw.js'))res.setHeader('Service-Worker-Allowed',de?'/de/uncle-jim-generator':'/uncle-jim-generator');
    res.setHeader('Content-Security-Policy',path.endsWith('sw.js')?"default-src 'none'; script-src 'self'; connect-src 'self'":"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; worker-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'");
    res.end(await readFile(path));
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1');
