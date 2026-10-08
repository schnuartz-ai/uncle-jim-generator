import { describe, expect, it } from 'vitest';
import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { crypto } from 'bitcoinjs-lib';
import { base58check } from '@scure/base';
import { checksum } from '@bitcoinerlab/descriptors';
import { buildWallet, preflight, WalletError, type ScriptType } from '../src/bitcoin/engine';

export const XPUB='xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
export const PUBS=[
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
  '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
];
const fromHex=(s:string)=>Uint8Array.from(s.match(/../g)!, x=>parseInt(x,16));
const toHex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const b58=base58check(crypto.sha256);
function version(key:string,version:number) {const b=b58.decode(key);new DataView(b.buffer,b.byteOffset).setUint32(0,version);return b58.encode(b);}
function code(fn:()=>unknown,error:string) {try{fn();throw Error('expected rejection');}catch(e){expect(e).toBeInstanceOf(WalletError);expect((e as WalletError).code).toBe(error);}}

describe('official BIP32 and BIP86 reference vectors',()=>{
  it('imports official BIP32 vector 1 and matches all 24 receive scripts against scure',()=>{
    const publicNode=HDKey.fromExtendedKey(XPUB);
    expect(publicNode.publicKey).toEqual(HDKey.fromMasterSeed(fromHex('000102030405060708090a0b0c0d0e0f')).publicKey);
    const wallet=buildWallet(XPUB);
    expect(wallet.addresses.map(a=>a.index)).toEqual(Array.from({length:24},(_,i)=>i+1));
    wallet.addresses.forEach((a,i)=>{const reference=btc.p2wpkh(publicNode.derive(`m/0/${i+1}`).publicKey!);expect(a.address).toBe(reference.address);expect(a.scriptPubKey).toBe(toHex(reference.script));});
  });
  it('matches official BIP86 first address and script, including tweak',()=>{
    const account='xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ';
    const a=buildWallet(account,{scriptType:'tr',start:0,count:1}).addresses[0];
    expect(a.address).toBe('bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr');
    expect(a.scriptPubKey).toBe('5120a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c');
  });
  it.each(['pkh','sh-wpkh','wpkh','tr'] as ScriptType[])('matches independent %s derivation',script=>{
    const key=HDKey.fromExtendedKey(XPUB).derive('m/0/0').publicKey!;
    const reference=script==='pkh'?btc.p2pkh(key):script==='sh-wpkh'?btc.p2sh(btc.p2wpkh(key)):script==='tr'?btc.p2tr(key.slice(1)):btc.p2wpkh(key);
    const a=buildWallet(XPUB,{scriptType:script,start:0,count:1}).addresses[0];
    expect(a.address).toBe(reference.address);expect(a.scriptPubKey).toBe(toHex(reference.script));
  });
});
describe('descriptor semantics',()=>{
  it.each(['sh','wsh','sh-wsh'])('matches independent 2-of-3 %s multisig',wrapper=>{
    const inner=`multi(2,${PUBS.join(',')})`;
    const descriptor=wrapper==='sh-wsh'?`sh(wsh(${inner}))`:`${wrapper}(${inner})`;
    const multi=btc.p2ms(2,PUBS.map(fromHex));
    const reference=wrapper==='sh'?btc.p2sh(multi):wrapper==='wsh'?btc.p2wsh(multi):btc.p2sh(btc.p2wsh(multi));
    const wallet=buildWallet(descriptor,{network:'mainnet'});
    expect(wallet.ranged).toBe(false);expect(wallet.addresses).toHaveLength(1);
    expect(wallet.addresses[0].address).toBe(reference.address);expect(wallet.addresses[0].scriptPubKey).toBe(toHex(reference.script));
  });
  it('preserves multi order while sortedmulti is order invariant',()=>{
    const derive=(type:string,pubs:string[])=>buildWallet(`wsh(${type}(2,${pubs.join(',')}))`,{network:'mainnet'}).addresses[0].address;
    expect(derive('multi',PUBS)).not.toBe(derive('multi',[...PUBS].reverse()));
    expect(derive('sortedmulti',PUBS)).toBe(derive('sortedmulti',[...PUBS].reverse()));
  });
  it('validates checksum, preserves original and distinguishes missing checksum',()=>{
    const d=`wpkh(${XPUB}/0/*)`;
    expect(buildWallet(d).missingChecksum).toBe(true);
    expect(buildWallet(`${d}#${checksum(d)}`).original).toBe(`${d}#${checksum(d)}`);
    expect(buildWallet(`${d}#${checksum(d)}`).missingChecksum).toBe(false);
    code(()=>buildWallet(`${d}#aaaaaaaa`),'checksum');
    code(()=>buildWallet(`${d}#bad`),'checksum');
  });
  it('keeps origin metadata distinct from remaining derivation',()=>{
    const wallet=buildWallet(`[d34db33f/84h/0h/0h]${XPUB}/0/*`,{count:1});
    expect(wallet.keys[0].fingerprint).toBe('d34db33f');
    expect(wallet.keys[0].origin).toBe('/84h/0h/0h');
    expect(wallet.keys[0].remaining).toBe('/0/*');
  });
  it('uses the external branch of multipath descriptors',()=>{
    expect(buildWallet(`wpkh(${XPUB}/<0;1>/*)`).addresses).toEqual(buildWallet(XPUB).addresses);
    expect(buildWallet(`wpkh(${XPUB}/**)`).addresses).toEqual(buildWallet(XPUB).addresses);
  });
  it('supports WSH miniscript and matches independent script encoding',()=>{
    const script=btc.Script.encode([fromHex(PUBS[0]),'CHECKSIGVERIFY',10,'CHECKSEQUENCEVERIFY']);
    const a=buildWallet(`wsh(and_v(v:pk(${PUBS[0]}),older(10)))`,{network:'mainnet'}).addresses[0];
    const reference=btc.p2wsh({type:'miniscript',script},undefined,true);
    expect(a.address).toBe(reference.address);expect(a.scriptPubKey).toBe(toHex(reference.script));
  });
  it('rejects unsupported descriptors rather than partially interpreting',()=>{
    code(()=>buildWallet(`wsh(unknown(${PUBS[0]}))`,{network:'mainnet'}),'descriptor');
    code(()=>buildWallet(`wpkh(${XPUB}/0h/*)`),'descriptor');
  });
  it.each(['multi_a','sortedmulti_a'])('matches independent Taproot tree and %s leaf scripts',type=>{
    const xonly=PUBS.map(k=>fromHex(k.slice(2)));
    const ordered=type==='sortedmulti_a'?[...xonly].sort((a,b)=>toHex(a).localeCompare(toHex(b))):xonly;
    const leaf=btc.p2tr_ms(2,ordered);
    const internal='cc8a4bc64d897bddc5fbc2f670f7a8ba0b386779106cf1223c6fc5d7cd6fc115';
    const reference=btc.p2tr(fromHex(internal),[{script:new Uint8Array(btc.p2tr_pk(xonly[1]).script)},{script:new Uint8Array(leaf.script)}]);
    const descriptor=`tr(${internal},{pk(${PUBS[1].slice(2)}),${type}(2,${PUBS.map(k=>k.slice(2)).join(',')})})`;
    const actual=buildWallet(descriptor,{network:'mainnet'}).addresses[0];
    expect(actual.address).toBe(reference.address);expect(actual.scriptPubKey).toBe(toHex(reference.script));
  });
});
describe('network and SLIP-132 handling',()=>{
  it('requires explicit network for raw public keys',()=>code(()=>buildWallet(`wpkh(${PUBS[0]})`),'networkRequired'));
  it('automatically infers the test network family',()=>{
    const tpub=version(XPUB,0x043587cf);
    const wallet=buildWallet(tpub,{count:1});expect(wallet.network).toBe('testnet');expect(wallet.addresses[0].address).toMatch(/^tb1/);
    code(()=>buildWallet(tpub,{network:'mainnet'}),'network');
    expect(buildWallet(tpub,{network:'regtest',count:1}).addresses[0].address).toMatch(/^bcrt1/);
  });
  it('rejects mixed-network signers',()=>code(()=>buildWallet(`wsh(multi(2,${XPUB}/0/*,${version(XPUB,0x043587cf)}/0/*))`),'network'));
  it.each([[0x049d7cb2,'sh-wpkh'],[0x04b24746,'wpkh']] as const)('honors SLIP-132 %s and rejects conflicts',(v,script)=>{
    const encoded=version(XPUB,v);
    expect(buildWallet(encoded,{count:1}).addresses).toEqual(buildWallet(XPUB,{scriptType:script,count:1}).addresses);
    code(()=>buildWallet(encoded,{scriptType:'pkh'}),'scriptConflict');
  });
  it('rejects corrupt extended-key checksums',()=>code(()=>buildWallet(XPUB.slice(0,-1)+'9'),'key'));
});
describe('public-only validation and bounds',()=>{
  it.each(['abandon '.repeat(11)+'about','0'.repeat(64),'xprvSensitive','L1aW4aubDFB7yfras2S1mME3ZJvWkH3Sd9X7FgMaC5RzGXt5wTzM'])('never exposes rejected secret input',input=>{
    try {buildWallet(input);}catch(e){expect(String(e)).not.toContain(input);}
  });
  it('rejects valid WIF even inside a descriptor',()=>{
    const wif=btc.WIF().encode(fromHex('00'.repeat(31)+'01'));
    code(()=>buildWallet(`pkh(${wif})`,{network:'mainnet'}),'secret');
  });
  it('bounds input, complexity and requested addresses',()=>{
    code(()=>preflight('x'.repeat(8193)),'size');code(()=>preflight('('.repeat(25)),'complexity');
    code(()=>buildWallet(XPUB,{count:97}),'range');code(()=>buildWallet(XPUB,{start:2147483647,count:2}),'range');
  });
});
