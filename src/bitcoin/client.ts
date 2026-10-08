import { preflight, WalletError, type WalletOptions, type WalletModel } from './engine';
export function deriveWallet(input:string,options:WalletOptions):Promise<WalletModel> {
  preflight(input);
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>{worker.terminate();reject(new WalletError('timeout'));},12000);
    worker.onmessage=event=>{clearTimeout(timeout);worker.terminate();if(event.data.error)reject(new WalletError(event.data.error));else resolve(event.data.wallet);};
    worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(new WalletError('descriptor'));};
    worker.postMessage({input,options});
  });
}
