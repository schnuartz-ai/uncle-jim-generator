import { jsPDF } from 'jspdf';
import packageJson from '../../package.json';
import QRCode from 'qrcode';
import fonts from './font-data.json';
import { WalletError, type WalletModel } from '../bitcoin/engine';
import { messages, type Language } from '../i18n/messages';

export const GEOMETRY={pageWidth:210,pageHeight:297,x:20,y:20,width:170,height:200,qrSize:15.5,columns:4,rows:6,addressStartX:25,addressStartY:85,addressColumnGap:40,addressRowGap:23,descriptorQrX:136,descriptorQrY:23,descriptorQrSize:48};
export function createQr(value:string) {return QRCode.create(value,{errorCorrectionLevel:'M'});}
function qr(doc:jsPDF,value:string,x:number,y:number,size:number,matrix=createQr(value).modules) {
  const unit=size/(matrix.size+8);
  doc.setFillColor(255,255,255);doc.rect(x,y,size,size,'F');doc.setFillColor(0,0,0);
  for(let row=0;row<matrix.size;row++) {
    for(let col=0;col<matrix.size;col++) {
      if(!matrix.get(row,col))continue;
      const start=col;while(col+1<matrix.size&&matrix.get(row,col+1))col++;
      doc.rect(x+(start+4)*unit,y+(row+4)*unit,(col-start+1)*unit,unit,'F');
    }
  }
}
function addFonts(doc:jsPDF) {
  doc.addFileToVFS('NotoSans-Regular.ttf',fonts.regular);doc.addFont('NotoSans-Regular.ttf','Noto','normal');
  doc.addFileToVFS('NotoSans-Bold.ttf',fonts.bold);doc.addFont('NotoSans-Bold.ttf','Noto','bold');doc.setFont('Noto','normal');
}
export function safeFilename(name:string) {return `uncle-jim-${name.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'wallet'}.pdf`;}
export function generatePdf(wallet:WalletModel,name:string,description:string,language:Language):jsPDF {
  if(!name.trim()||name.length>80||description.length>1000)throw new WalletError('size');
  const t=messages[language];
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});addFonts(doc);
  // Fail explicitly for unavailable glyphs instead of silently dropping user text.
  const metadata=doc.getFont().metadata as {cmap?:{unicode?:{codeMap?:Record<number,number>}}};
  const glyphs=metadata.cmap?.unicode?.codeMap;
  for(const character of name+description) if(character!=='\n'&&character!=='\r'&&glyphs&&!glyphs[character.codePointAt(0)!])throw new WalletError('font');
  doc.setProperties({title:'Uncle Jim public address sheet',subject:'Public wallet information',author:'ClavaStack',creator:`ClavaStack Uncle Jim Generator ${packageJson.version}`});
  const text=(s:string,x:number,y:number,size=9,bold=false)=>{doc.setFont('Noto',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(20,28,37);doc.text(s,x,y);};
  const centeredText=(s:string,x:number,y:number,size=9,bold=false)=>{doc.setFont('Noto',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(20,28,37);doc.text(s,x,y,{align:'center'});};
  const brand=(s:string,x:number,y:number)=>{
    doc.setFont('Noto','bold');doc.setFontSize(8);doc.setTextColor(20,28,37);
    doc.text(s,x,y);const width=doc.getTextWidth(s);
    doc.setDrawColor(31,153,229);doc.setLineWidth(.7);doc.line(x,y+3.2,x+width,y+3.2);
  };
  const wrap=(s:string,width:number,size:number):string[]=>{doc.setFont('Noto','normal');doc.setFontSize(size);return doc.splitTextToSize(s,width);};
  const policy=wallet.scriptType.replace(/@\d+/g,'key');
  const policyShort=policy.length>110?`${policy.slice(0,100)}…`:policy;
  const network=wallet.network==='mainnet'?t.mainnet:wallet.network==='regtest'?t.regtest:t.testnet;
  const productBase=`https://clavastack.com${language==='de'?'/de':''}/products/`;
  const bags=productBase+'debasafetueten',stack=productBase+'backup-stack';

  for(let page=0;page<Math.ceil(wallet.addresses.length/(GEOMETRY.columns*GEOMETRY.rows));page++) {
    if(page)doc.addPage();
    doc.setDrawColor(110,120,130);doc.setLineWidth(.25);doc.setLineDashPattern([1.5,1.5],0);doc.rect(20,20,170,200);doc.setLineDashPattern([],0);
    brand('CLAVASTACK  /  UNCLE JIM WALLET',26,29);
    const nameLines=wrap(name.replace(/\s+/g,' '),104,12);
    nameLines.forEach((line,i)=>text(line,26,40+i*5,12,true));
    let headerY=40+nameLines.length*5+1;
    text(network,26,headerY,7);headerY+=4.5;
    const policyLines=wrap(`${t.walletType}: ${policyShort}`,104,6.2);
    policyLines.forEach((line,i)=>text(line,26,headerY+i*3.1,6.2));headerY+=policyLines.length*3.1;
    if(description)text(t.descriptionOnRecovery,26,headerY+2,6.2);
    let descriptorMatrix;
    try {
      const candidate=createQr(wallet.descriptor).modules;
      if(GEOMETRY.descriptorQrSize/(candidate.size+8)>=.28)descriptorMatrix=candidate;
    } catch {descriptorMatrix=undefined;}
    if(descriptorMatrix) {
      qr(doc,wallet.descriptor,GEOMETRY.descriptorQrX,GEOMETRY.descriptorQrY,GEOMETRY.descriptorQrSize,descriptorMatrix);
      centeredText(t.watchOnly,GEOMETRY.descriptorQrX+GEOMETRY.descriptorQrSize/2,74,7.5,true);
      centeredText(t.descriptorQr,GEOMETRY.descriptorQrX+GEOMETRY.descriptorQrSize/2,78,5.1);
    } else {
      wrap(t.qrTooLarge,50,6).forEach((line,i)=>text(line,GEOMETRY.descriptorQrX,44+i*3.2,6));
    }
    text(t.verified,26,78,7,true);text(t.sheetNote,26,82,6.2);
    const selected=wallet.addresses.slice(page*(GEOMETRY.columns*GEOMETRY.rows),(page+1)*(GEOMETRY.columns*GEOMETRY.rows));
    selected.forEach((address,i)=> {
      const col=i%GEOMETRY.columns,row=Math.floor(i/GEOMETRY.columns);
      const x=GEOMETRY.addressStartX+col*GEOMETRY.addressColumnGap,y=GEOMETRY.addressStartY+row*GEOMETRY.addressRowGap;
      qr(doc,address.address,x,y,GEOMETRY.qrSize);
      doc.setDrawColor(30,30,30);doc.setLineWidth(.2);doc.rect(x+28,y+1,3,3);
      text(address.index===null?'#1':`#${address.index}`,x+17,y+4,4.8,true);
      wrap(address.address,21.5,4.5).forEach((line,j)=>text(line,x+17,y+7.5+j*1.9,4.5));
    });
    text(t.print,20,14,6.5);
    doc.setDrawColor(110,120,130);doc.setLineDashPattern([1.5,1.5],0);doc.line(20,228,190,228);doc.setLineDashPattern([],0);
    text(t.stripTitle,20,236,10,true);
    const intro=wrap(t.stripIntro,118,6.6);intro.forEach((s,i)=>text(s,20,241+i*3,6.6));
    let sy=248;
    t.steps.forEach((s,i)=>{text(`${i+1}. ${s}`,20,sy,6.3);sy+=3.3;});
    text(t.recommendation,20,267,7,true);
    wrap(t.recommendationText,118,6.2).forEach((s,i)=>text(s,20,271+i*3,6.2));
    wrap(t.tamper,170,6.2).forEach((s,i)=>text(s,20,282+i*3,6.2));
    qr(doc,bags,143,242,20);qr(doc,stack,169,242,20);
    text(t.bags,143,266,6);text(t.stack,169,266,6);
    text('clavastack.com',143,272,6);
    text(`${language==='de'?'/de':''}/products/debasafetueten`,143,275,5.5);
    text(`${language==='de'?'/de':''}/products/backup-stack`,143,278,5.5);
    doc.link(143,242,20,37,{url:bags});doc.link(169,242,20,37,{url:stack});
  }
  // Recovery pages use normal A4 margins: everything below is retained, never on the discard strip.
  doc.addPage();let y=28;
  text(t.recovery,20,20,15,true);
  const paragraph=(s:string,size=8,bold=false)=> {
    const lines=wrap(s,170,size);
    for(const line of lines) {
      if(y>277){doc.addPage();text(t.recovery,20,20,11,true);y=30;}
      text(line,20,y,size,bold);y+=size*.48;
    }
    y+=3;
  };
  const block=(heading:string,value:string)=>{paragraph(heading,9,true);paragraph(value,7.5);};
  block(t.name,name);if(description)block(t.description,description);
  paragraph(t.backupWarning,9,true);paragraph(t.security);
  block(t.network,network);block(t.walletType,policy);
  block(t.rangeLabel,wallet.ranged?`${wallet.addresses[0].index} - ${wallet.addresses.at(-1)!.index}`:t.fixed);
  if(wallet.assumedPath)paragraph(t.assumed);
  if(wallet.missingChecksum)paragraph(t.missing);
  block(t.original,wallet.original);block(t.effective,wallet.descriptor);
  if(wallet.originalChange)block(t.changeOriginal,wallet.originalChange);
  if(wallet.changeDescriptor)block(t.changeEffective,wallet.changeDescriptor);
  if(wallet.multipath)paragraph(language==='de'?'Der Multipath-Descriptor enthält Empfangs- und Change-Pfade. Auf diesem Blatt wird der externe Pfad 0 verwendet.':'The multipath descriptor contains receive and change paths. This sheet uses external branch 0.');
  paragraph(t.keys,10,true);
  wallet.keys.forEach((key,i)=>{
    block(`${t.keyLabel} ${i+1}`,key.expression);
    if(key.xpub)block('XPub',key.xpub);
    paragraph(`${t.fingerprint}: ${key.fingerprint??t.unknown}\n${t.origin}: ${key.origin??t.unknown}\n${t.remaining}: ${key.remaining??t.unknown}`,7);
  });
  paragraph(t.about,7);
  for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);text(`${p} / ${doc.getNumberOfPages()}`,185,293,6);}
  return doc;
}
