import { Output, expand, checksum, networks, type KeyInfo, type TapTreeInfoNode } from '@bitcoinerlab/descriptors';
import { crypto } from 'bitcoinjs-lib';
import { base58check } from '@scure/base';

export type ScriptType = 'wpkh' | 'tr' | 'sh-wpkh' | 'pkh';
export type NetworkFamily = 'mainnet' | 'testnet' | 'regtest';
export type ErrorCode = 'secret' | 'size' | 'complexity' | 'checksum' | 'key' | 'network' | 'networkRequired' | 'scriptConflict' | 'descriptor' | 'range' | 'change' | 'timeout' | 'font';
export class WalletError extends Error { constructor(public code: ErrorCode) { super(code); } }
export interface WalletOptions { scriptType?: ScriptType; network?: NetworkFamily; remainingPath?: string; start?: number; count?: number; changeDescriptor?: string }
export interface PublicKeyDetails { expression: string; xpub?: string; fingerprint?: string; origin?: string; remaining?: string }
export interface WalletModel {
  original: string; descriptor: string; changeDescriptor?: string; originalChange?: string;
  network: NetworkFamily; scriptType: string; ranged: boolean; missingChecksum: boolean;
  bare: boolean; assumedPath: boolean; multipath: boolean; keys: PublicKeyDetails[];
  addresses: { index: number | null; address: string; scriptPubKey: string }[];
}
const b58 = base58check(crypto.sha256);
const versions: Record<number,{ network: NetworkFamily; script?: ScriptType; multisig?: string }> = {
  0x0488b21e:{network:'mainnet'}, 0x043587cf:{network:'testnet'},
  0x049d7cb2:{network:'mainnet',script:'sh-wpkh'}, 0x04b24746:{network:'mainnet',script:'wpkh'},
  0x044a5262:{network:'testnet',script:'sh-wpkh'}, 0x045f1cf6:{network:'testnet',script:'wpkh'},
  0x0295b43f:{network:'mainnet',multisig:'sh(wsh('}, 0x02aa7ed3:{network:'mainnet',multisig:'wsh('},
  0x024289ef:{network:'testnet',multisig:'sh(wsh('}, 0x02575483:{network:'testnet',multisig:'wsh('},
};
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');

/** Resource/secret preflight only. Descriptor grammar and scripts are handled by BitcoinerLAB. */
export function preflight(input: string): void {
  if (input.length > 8192) throw new WalletError('size');
  if (/(?:[xtyzuvYZUV]prv|\b(?:seed|mnemonic|private_key|xprv)\b)/i.test(input) || /^[a-fA-F0-9]{64}$/.test(input.trim()) || input.trim().split(/\s+/).length >= 12) throw new WalletError('secret');
  let depth=0, nodes=0;
  for (const c of input) {
    if (c==='(' || c==='{') { depth++; nodes++; }
    if (c===')' || c==='}') depth--;
    if (depth > 24 || nodes > 96) throw new WalletError('complexity');
  }
  // A Base58Check private key can be embedded in a descriptor. Never pass it to the parser.
  for (const token of input.match(/[A-Za-z0-9]+/g) ?? []) {
    if (token.length < 50 || token.length > 120) continue;
    let bytes: Uint8Array;
    try { bytes=b58.decode(token); } catch { continue; }
    if ((bytes.length===33 || bytes.length===34) && (bytes[0]===0x80 || bytes[0]===0xef)) throw new WalletError('secret');
    if (bytes.length===78 && bytes[45]===0) throw new WalletError('secret');
  }
}
function checkedBody(input: string): {body:string; missing:boolean} {
  const pieces=input.trim().split('#');
  if (pieces.length>2 || (pieces.length===2 && (pieces[1].length!==8 || checksum(pieces[0])!==pieces[1]))) throw new WalletError('checksum');
  return {body:pieces[0],missing:pieces.length===1};
}
function normalizeKeys(body: string, bare: boolean, options: WalletOptions): {body:string; network:NetworkFamily; convention?:ScriptType} {
  const families=new Set<NetworkFamily>();
  let convention: ScriptType | undefined;
  const normalized=body.replace(/[A-Za-z0-9]+/g, token => {
    if (!/^[xtyzuvYZUV]pub/.test(token)) return token;
    let bytes: Uint8Array;
    try { bytes=b58.decode(token); } catch { throw new WalletError('key'); }
    if (bytes.length!==78) throw new WalletError('key');
    const version=new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0);
    const info=versions[version];
    if (!info || bytes[45]===0) throw new WalletError('key');
    families.add(info.network);
    if (info.script) {
      if (bare) { convention=info.script; if(options.scriptType && options.scriptType!==info.script) throw new WalletError('scriptConflict'); }
      else if (!(info.script==='wpkh' ? body.startsWith('wpkh(') : body.startsWith('sh(wpkh('))) throw new WalletError('scriptConflict');
    }
    if (info.multisig && (bare || !body.startsWith(info.multisig))) throw new WalletError('scriptConflict');
    const copy=bytes.slice();
    new DataView(copy.buffer).setUint32(0, info.network==='mainnet' ? 0x0488b21e : 0x043587cf);
    return b58.encode(copy);
  });
  if (families.size>1) throw new WalletError('network');
  const inferred=[...families][0];
  if (inferred && options.network && (inferred==='mainnet' ? options.network!=='mainnet' : options.network==='mainnet')) throw new WalletError('network');
  const network=options.network ?? inferred;
  if (!network) throw new WalletError('networkRequired');
  return {body:normalized,network,convention};
}
function gatherKeys(map: Record<string,KeyInfo> | undefined, tree: TapTreeInfoNode | undefined): KeyInfo[] {
  const keys=Object.values(map??{});
  if(tree) {
    if('left' in tree) keys.push(...gatherKeys(undefined,tree.left),...gatherKeys(undefined,tree.right));
    else keys.push(...Object.values(tree.expansionMap));
  }
  return keys;
}
export function buildWallet(input: string, options: WalletOptions={}): WalletModel {
  preflight(input);
  const start=options.start??1, count=options.count??24;
  if(!Number.isSafeInteger(start)||start<0||start>2147483647||!Number.isSafeInteger(count)||count<1||count>96||start+count-1>2147483647) throw new WalletError('range');
  try {
    const checked=checkedBody(input);
    const bare=!checked.body.includes('(');
    const normalized=normalizeKeys(checked.body,bare,options);
    let descriptor=normalized.body;
    let assumedPath=false;
    if(bare) {
      const endOrigin=descriptor.startsWith('[')?descriptor.indexOf(']')+1:0;
      const keyAndSuffix=descriptor.slice(endOrigin);
      if(!/^[xt]pub/.test(keyAndSuffix)) throw new WalletError('key');
      const slash=descriptor.indexOf('/',endOrigin);
      if(options.remainingPath!==undefined) {
        descriptor=(slash===-1?descriptor:descriptor.slice(0,slash))+options.remainingPath;
      } else if(slash===-1) { descriptor+='/0/*'; assumedPath=true; }
      const script=normalized.convention??options.scriptType??'wpkh';
      descriptor=script==='sh-wpkh'?`sh(wpkh(${descriptor}))`:`${script}(${descriptor})`;
    }
    const network=normalized.network==='mainnet'?networks.bitcoin:normalized.network==='regtest'?networks.regtest:networks.testnet;
    const multipath=descriptor.includes('<')||descriptor.includes('/**');
    const expansion=expand({descriptor,network,...(multipath?{change:0}:{})});
    const keys=gatherKeys(expansion.expansionMap,expansion.tapTreeInfo);
    if(keys.length>20) throw new WalletError('complexity');
    if(keys.some(k=>k.privkey||k.xPrv||k.bip32?.privateKey||k.ecpair?.privateKey)) throw new WalletError('secret');
    const ranged=expansion.isRanged;
    const addresses=Array.from({length:ranged?count:1},(_,i)=> {
      const output=new Output({descriptor,network,...(ranged?{index:start+i}:{}),...(multipath?{change:0}:{})});
      return {index:ranged?start+i:null,address:output.getAddress(),scriptPubKey:hex(output.getScriptPubKey())};
    });
    let changeDescriptor:string|undefined;
    if(options.changeDescriptor?.trim()) {
      const change=buildWallet(options.changeDescriptor,{network:normalized.network,start,count:1});
      const receiveKeys=keys.map(k=>k.xPub??k.keyExpression).sort();
      const changeKeys=change.keys.map(k=>k.xpub??k.expression).sort();
      if(JSON.stringify(receiveKeys)!==JSON.stringify(changeKeys)||change.scriptType!==expansion.expandedExpression) throw new WalletError('change');
      changeDescriptor=change.descriptor;
    }
    return {
      original:input,descriptor:`${descriptor}#${checksum(descriptor)}`,
      originalChange:options.changeDescriptor,changeDescriptor,network:normalized.network,
      scriptType:expansion.expandedExpression??descriptor.slice(0,descriptor.indexOf('(')),ranged,missingChecksum:checked.missing&&!bare,bare,assumedPath,multipath,
      keys:keys.map(k=>({expression:k.keyExpression,xpub:k.xPub,fingerprint:k.masterFingerprint?hex(k.masterFingerprint):undefined,origin:k.originPath,remaining:k.keyPath})),addresses,
    };
  } catch(error) {
    if(error instanceof WalletError) throw error;
    // Upstream errors may contain the complete rejected input. Do not expose/log them.
    throw new WalletError('descriptor');
  }
}
