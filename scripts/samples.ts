import { mkdir,writeFile } from 'node:fs/promises';
import { buildWallet } from '../src/bitcoin/engine';
import { generatePdf } from '../src/pdf/generator';
const xpub='xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
const keys=['0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5','02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'];
const fixtures=[
  {id:'native-segwit-en',input:xpub,options:{},language:'en' as const},
  {id:'native-segwit-de',input:xpub,options:{},language:'de' as const},
  {id:'taproot-en',input:xpub,options:{scriptType:'tr' as const},language:'en' as const},
  {id:'multisig-2-of-3-de',input:`wsh(sortedmulti(2,${keys.join(',')}))`,options:{network:'mainnet' as const},language:'de' as const},
  {id:'miniscript-en',input:`wsh(and_v(v:pk(${keys[0]}),older(10)))`,options:{network:'mainnet' as const},language:'en' as const},
  {id:'taproot-tree-de',input:`tr(${keys[0].slice(2)},{pk(${keys[1].slice(2)}),multi_a(2,${keys[1].slice(2)},${keys[2].slice(2)})})`,options:{network:'mainnet' as const},language:'de' as const},
];
await mkdir('output/pdf',{recursive:true});
for(const f of fixtures){const wallet=buildWallet(f.input,f.options);const doc=generatePdf(wallet,'ClavaStack · Family Wallet','Öffentliche Testdaten / Public test data — Grüße aus Köln.',f.language);await writeFile(`output/pdf/${f.id}.pdf`,new Uint8Array(doc.output('arraybuffer')));await writeFile(`output/pdf/${f.id}.json`,JSON.stringify(wallet,null,2));console.log(`${f.id}: ${doc.getNumberOfPages()} pages, ${wallet.addresses.length} addresses`);}
