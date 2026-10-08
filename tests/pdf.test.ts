import { describe,expect,it } from 'vitest';
import jsQR from 'jsqr';
import { buildWallet,WalletError } from '../src/bitcoin/engine';
import { generatePdf,createQr,safeFilename,GEOMETRY } from '../src/pdf/generator';
const XPUB='xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
describe('PDF output',()=>{
  it('fits the retained sheet in the documented bag with 10 mm tolerance',()=>{expect(GEOMETRY.width).toBe(170);expect(GEOMETRY.height).toBe(200);expect(GEOMETRY.width).toBeLessThan(180);expect(GEOMETRY.height).toBeLessThan(210);expect(GEOMETRY.x*2+GEOMETRY.width).toBe(210);expect(GEOMETRY.columns).toBe(3);expect(GEOMETRY.rows).toBe(8);expect(GEOMETRY.descriptorQrSize).toBeGreaterThan(40);});
  it.each(['en','de'] as const)('creates complete %s PDFs with 24 addresses and a recovery page',language=>{
    const wallet=buildWallet(XPUB);const pdf=generatePdf(wallet,'Grüße aus Köln','Öffentliche Daten',language);
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
