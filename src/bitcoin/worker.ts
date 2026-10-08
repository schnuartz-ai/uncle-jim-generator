import { buildWallet, WalletError, type WalletOptions } from './engine';
self.onmessage=(event:MessageEvent<{input:string;options:WalletOptions}>)=> {
  try { self.postMessage({wallet:buildWallet(event.data.input,event.data.options)}); }
  catch(error) { self.postMessage({error:error instanceof WalletError?error.code:'descriptor'}); }
};
