import { describe,expect,it } from 'vitest';
import jsQR from 'jsqr';
import { buildWallet,WalletError } from '../src/bitcoin/engine';
import { generatePdf,createQr,safeFilename,GEOMETRY,walletDisplay,splitAddressText } from '../src/pdf/generator';
const XPUB='xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
const PUBS=['0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5','02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'];
describe('PDF output',()=>{
  it('labels single-sig and standard address formats in German and English',()=>{
    const wallet=buildWallet(XPUB);
    expect(walletDisplay(wallet,'de')).toEqual({addressFormat:'Native SegWit (P2WPKH)',signatureType:'Single-Sig'});
    expect(walletDisplay(wallet,'en')).toEqual({addressFormat:'Native SegWit (P2WPKH)',signatureType:'Single-Sig'});
  });
  it('names legacy, nested and P2WSH address formats accurately',()=>{
    const legacy=buildWallet(XPUB,{scriptType:'pkh',count:1});
    const nested=buildWallet(XPUB,{scriptType:'sh-wpkh',count:1});
    const p2sh=buildWallet(`sh(sortedmulti(2,${PUBS.join(',')}))`,{network:'mainnet'});
    const p2wsh=buildWallet(`wsh(multi(2,${PUBS.join(',')}))`,{network:'mainnet'});
    expect(walletDisplay(legacy,'de').addressFormat).toBe('Legacy (P2PKH)');
    expect(walletDisplay(nested,'de').addressFormat).toBe('Nested SegWit (P2SH-P2WPKH)');
    expect(walletDisplay(p2sh,'de').addressFormat).toBe('Legacy (P2SH)');
    expect(walletDisplay(p2wsh,'de').addressFormat).toBe('Native SegWit (P2WSH)');
  });
  it('shows the address script and exact threshold for nested multisig',()=>{
    const wallet=buildWallet(`sh(wsh(sortedmulti(2,${PUBS.join(',')})))`,{network:'mainnet'});
    expect(walletDisplay(wallet,'de')).toEqual({addressFormat:'Nested SegWit (P2SH-P2WSH)',signatureType:'Multi-Sig (2-von-3)'});
    expect(walletDisplay(wallet,'en')).toEqual({addressFormat:'Nested SegWit (P2SH-P2WSH)',signatureType:'Multi-Sig (2-of-3)'});
  });
  it('identifies Taproot script-path multisig while keeping the Taproot address format',()=>{
    const keys=PUBS.map(key=>key.slice(2));
    const wallet=buildWallet(`tr(${keys[0]},{pk(${keys[1]}),multi_a(2,${keys.join(',')})})`,{network:'mainnet'});
    expect(walletDisplay(wallet,'de')).toEqual({addressFormat:'Taproot (P2TR)',signatureType:'Multi-Sig (2-von-3)'});
  });
  it('fits unchanged address QR codes and two-line labels in a six-column, five-row sheet',()=>{
    expect(GEOMETRY.width).toBe(170);expect(GEOMETRY.height).toBe(200);expect(GEOMETRY.width).toBeLessThan(180);expect(GEOMETRY.height).toBeLessThan(210);expect(GEOMETRY.x*2+GEOMETRY.width).toBe(210);
    expect(GEOMETRY.columns).toBe(6);expect(GEOMETRY.rows).toBe(5);expect(GEOMETRY.qrSize).toBe(20.5);expect(GEOMETRY.addressTextLines).toBe(2);expect(GEOMETRY.addressTextOffset).toBeGreaterThan(GEOMETRY.addressIndexOffset);
    expect(GEOMETRY.addressTextWidth).toBeLessThan(GEOMETRY.addressColumnGap);
    expect(GEOMETRY.addressGridStartX+GEOMETRY.columns*GEOMETRY.addressColumnGap).toBeLessThanOrEqual(GEOMETRY.x+GEOMETRY.width);
    expect(GEOMETRY.checkboxOffset+3).toBeLessThan((GEOMETRY.addressColumnGap-GEOMETRY.qrSize)/2);
    expect(GEOMETRY.addressStartY+(GEOMETRY.rows-1)*GEOMETRY.addressRowGap+GEOMETRY.qrSize+GEOMETRY.addressTextOffset+(GEOMETRY.addressTextLines-1)*GEOMETRY.addressTextLineGap+GEOMETRY.addressTextSize*25.4/72).toBeLessThanOrEqual(GEOMETRY.y+GEOMETRY.height);
    expect(GEOMETRY.descriptorQrSize).toBeGreaterThan(40);
  });
  it('splits each complete address across exactly two balanced text lines',()=>{
    for(const {address} of buildWallet(XPUB).addresses){
      const lines=splitAddressText(address);
      expect(lines).toHaveLength(2);expect(lines[0]+lines[1]).toBe(address);expect(Math.abs(lines[0].length-lines[1].length)).toBeLessThanOrEqual(1);
    }
  });
  it.each(['en','de'] as const)('creates complete %s PDFs with 30 addresses and a recovery page',language=>{
    const wallet=buildWallet(XPUB);const pdf=generatePdf(wallet,'Grüße aus Köln','Öffentliche Daten',language);
    expect(wallet.addresses).toHaveLength(30);
    expect(pdf.getNumberOfPages()).toBe(2);expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(100000);
  });
  it('paginates 96 addresses and 1000 characters without discarding content',()=>{
    const wallet=buildWallet(XPUB,{count:96});const pdf=generatePdf(wallet,'W'.repeat(80),'Long public description '.repeat(41),'en');
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(5);
  });
  it('rejects unsupported print glyphs explicitly',()=>{
    expect(()=>generatePdf(buildWallet(XPUB,{count:1}),'Wallet 🧡','','en')).toThrow(WalletError);
  });
  it('sanitizes only the download filename',()=>{expect(safeFilename('../../<Wallet>')).toBe('uncle-jim-Wallet.pdf');expect(safeFilename('💙')).toBe('uncle-jim-wallet.pdf');});
  it('encodes exact addresses with decodable local QRs',()=>{
    for(const a of buildWallet(XPUB).addresses){
      const matrix=createQr(a.address).modules,scale=6,width=(matrix.size+8)*scale;
      const rgba=new Uint8ClampedArray(width*width*4).fill(255);
      for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++)if(matrix.get(y,x))for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){
        const i=(((y+4)*scale+sy)*width+(x+4)*scale+sx)*4;rgba[i]=rgba[i+1]=rgba[i+2]=0;
      }
      expect(jsQR(rgba,width,width)?.data).toBe(a.address);
    }
  });
  it('encodes the exact checksummed receive descriptor in a decodable large QR',()=>{
    const descriptor=buildWallet(XPUB).descriptor,matrix=createQr(descriptor).modules,scale=5,width=(matrix.size+8)*scale;
    expect(GEOMETRY.descriptorQrSize/(matrix.size+8)).toBeGreaterThanOrEqual(.28);
    const rgba=new Uint8ClampedArray(width*width*4).fill(255);
    for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++)if(matrix.get(y,x))for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){
      const i=(((y+4)*scale+sy)*width+(x+4)*scale+sx)*4;rgba[i]=rgba[i+1]=rgba[i+2]=0;
    }
    expect(jsQR(rgba,width,width)?.data).toBe(descriptor);
  });
});
