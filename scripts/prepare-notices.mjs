import { readFile,readdir,writeFile } from 'node:fs/promises';
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
const cleanText=value=>value.replace(/\r\n?/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').replace(/\n+$/,'');
let notices=`ClavaStack Uncle Jim Generator — third-party license notices\n\n${cleanText(await readFile(new URL('../THIRD_PARTY_NOTICES.md',import.meta.url),'utf8'))}\n`;
for(const [path,info] of Object.entries(lock.packages)) {
  if(!path||info.dev)continue;
  const folder=new URL(`../${path}/`,import.meta.url);
  let files;try{files=await readdir(folder);}catch{continue;}
  const pkg=JSON.parse(await readFile(new URL('package.json',folder),'utf8'));
  notices+=`\n========================================\n${pkg.name} ${pkg.version} — ${pkg.license??'see license below'}\n`;
  for(const file of files.filter(f=>/^(?:licen[sc]e|copying|notice|ofl)(?:[._-]|$)/i.test(f))) {
    try{notices+=`\n${file}\n${cleanText(await readFile(new URL(file,folder),'utf8'))}\n`;}catch{ /* Some packages use a license directory. */ }
  }
}
await writeFile(new URL('../public/THIRD-PARTY-LICENSES.txt',import.meta.url),notices);
