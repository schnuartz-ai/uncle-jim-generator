import { useEffect, useState } from 'react';
import { deriveWallet } from '../bitcoin/client';
import { preflight, WalletError, type WalletModel, type ScriptType, type NetworkFamily } from '../bitcoin/engine';
import { generatePdf, safeFilename } from '../pdf/generator';
import { errorMessages, messages, type Language } from '../i18n/messages';
import logo from '../../public/clavastack-logo.png';

export function App() {
  const [language,setLanguage]=useState<Language>(location.pathname.startsWith('/de/')?'de':'en');
  const t=messages[language],prefix=language==='de'?'/de':'';
  const [input,setInput]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState('');
  const [script,setScript]=useState<ScriptType|''>(''),[network,setNetwork]=useState<NetworkFamily|''>('');
  const [path,setPath]=useState(''),[start,setStart]=useState(1),[count,setCount]=useState(24),[change,setChange]=useState('');
  const [wallet,setWallet]=useState<WalletModel|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);
  const [offline,setOffline]=useState<'loading'|'ready'|'error'>('loading');
  const [advanced,setAdvanced]=useState(false);
  const bare=!input.includes('(');
  const effectiveScript=script||(input.includes('ypub')||input.includes('upub')?'sh-wpkh':'wpkh');
  useEffect(()=>{document.documentElement.lang=language;document.title=`${messages[language].title} | ClavaStack`;},[language]);
  useEffect(()=>{
    if(!('serviceWorker' in navigator)){setOffline('error');return;}
    // Both language scopes are narrow. Assets are cached by the SW, never wallet input.
    const paths=['/uncle-jim-generator','/de/uncle-jim-generator'];
    const onMessage=(event:MessageEvent)=>{if(event.data?.type==='OFFLINE_READY')setOffline('ready');};
    navigator.serviceWorker.addEventListener('message',onMessage);
    Promise.all(paths.map(scope=>navigator.serviceWorker.register(`${scope}/sw.js`,{scope}))).then(async registrations=>{
      await navigator.serviceWorker.ready;
      const active=registrations.find(r=>r.scope.includes(location.pathname.startsWith('/de/')?'/de/':'/uncle-jim-generator/'))?.active;
      active?.postMessage({type:'CHECK_READY'});
    }).catch(()=>setOffline('error'));
    const timer=setTimeout(()=>setOffline(current=>current==='ready'?'ready':'error'),30000);
    return()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('message',onMessage);};
  },[]);
  useEffect(()=>{setWallet(null);setSuccess(false);setError('');},[input,script,network,path,start,count,change]);
  function updateInput(value:string) {
    try {preflight(value);setInput(value);setError('');}
    catch(e){setInput('');setWallet(null);setError(errorMessages[language][e instanceof WalletError?e.code:'descriptor']);}
  }
  async function run(download:boolean) {
    setError('');setSuccess(false);
    if(download&&(!name.trim()||name.length>80)){setError(t.nameRequired);return;}
    if(description.length>1000){setError(t.descLimit);return;}
    setBusy(true);
    try {
      const derived=await deriveWallet(input,{...(script?{scriptType:script}:{}),...(network?{network}:{}),...(path?{remainingPath:path}:{}),start,count,...(change?{changeDescriptor:change}:{})});
      setWallet(derived);
      if(download){const pdf=generatePdf(derived,name,description,language);pdf.save(safeFilename(name));setSuccess(true);}
    }catch(e){const code=e instanceof WalletError?e.code:'descriptor';setError(errorMessages[language][code]);if(code==='networkRequired')setAdvanced(true);}
    finally{setBusy(false);}
  }
  function clear(){setInput('');setName('');setDescription('');setChange('');setWallet(null);setError('');setSuccess(false);}
  return <>
    <header className="header"><a className="brand" href={`${prefix}/tools`} aria-label="ClavaStack Tools"><img src={logo} alt=""/><span>ClavaStack</span></a>
      <div className="header-links"><a href={`${prefix}/tools`}>{t.tools}<span aria-hidden="true"> ↗</span></a>
        <details className="menu"><summary aria-label={t.details}>•••</summary><nav><a href={`${prefix}/security-talk`}>{t.consultation}</a><a href={`${prefix}/uncle-jim-wallet`}>{t.info}</a><a href={`${prefix}/tools`}>Tools</a></nav></details>
        <div className="language" aria-label={language==='de'?'Sprache':'Language'}><button type="button" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button><span>/</span><button type="button" aria-pressed={language==='de'} onClick={()=>setLanguage('de')}>DE</button></div>
      </div></header>
    <main>
      <section className="hero"><p className="eyebrow">{t.badge}</p><h1>{t.title}</h1><p className="subtitle">{t.subtitle}</p></section>
      <div className="workspace">
        <section className="form-card">
          <form onSubmit={event=>{event.preventDefault();void run(true);}} autoComplete="off">
            <label htmlFor="wallet-input">{t.key}</label><textarea id="wallet-input" spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="none" rows={5} maxLength={8192} placeholder={t.placeholder} value={input} onChange={e=>updateInput(e.target.value)} aria-describedby="public-only"/>
            <p className="help" id="public-only">{t.publicOnly}</p>
            {bare&&input&&<div className="script-select"><label htmlFor="script">{t.script}</label><select id="script" value={effectiveScript} onChange={e=>setScript(e.target.value as ScriptType)}><option value="wpkh">{t.native}</option><option value="tr">{t.taproot}</option><option value="sh-wpkh">{t.nested}</option><option value="pkh">{t.legacy}</option></select><p className="help">{t.scriptHelp}</p></div>}
            <label htmlFor="wallet-name">{t.name}</label><input id="wallet-name" maxLength={80} placeholder={t.namePlaceholder} value={name} onChange={e=>{setName(e.target.value);setSuccess(false);}} autoComplete="off"/>
            <label htmlFor="description">{t.description}</label><textarea id="description" maxLength={1000} rows={3} placeholder={t.descriptionPlaceholder} value={description} onChange={e=>{setDescription(e.target.value);setSuccess(false);}}/>
            <details className="advanced" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}><summary>{t.advanced}</summary><div className="advanced-inner">
              {bare&&<><label htmlFor="path">{t.path}</label><input id="path" value={path} onChange={e=>setPath(e.target.value)} placeholder="/0/*" maxLength={128}/><p className="help">{t.pathHelp}</p></>}
              <label htmlFor="network">{t.network}</label><select id="network" value={network} onChange={e=>setNetwork(e.target.value as NetworkFamily|'')}><option value="">{t.auto}</option><option value="mainnet">{t.mainnet}</option><option value="testnet">{t.testnet}</option><option value="regtest">{t.regtest}</option></select><p className="help">{t.networkHelp}</p>
              <div className="field-row"><div><label htmlFor="start">{t.start}</label><input type="number" id="start" min={0} max={2147483647} value={start} onChange={e=>setStart(Number(e.target.value))}/></div><div><label htmlFor="count">{t.count}</label><input type="number" id="count" min={1} max={96} value={count} onChange={e=>setCount(Number(e.target.value))}/></div></div>
              <label htmlFor="change">{t.change}</label><textarea id="change" maxLength={8192} value={change} rows={3} onChange={e=>{try{preflight(e.target.value);setChange(e.target.value);}catch{setChange('');setError(errorMessages[language].secret);}}} spellCheck={false}/><p className="help">{t.changeHelp}</p>
            </div></details>
            {error&&<div role="alert" className="error"><strong>{t.errorHeading}</strong><p>{error}</p></div>}
            <div className="actions"><button className="primary" type="submit" disabled={busy||!input}>{busy?t.busy:t.generate}<span aria-hidden="true"> ↓</span></button><button className="secondary" type="button" disabled={busy||!input} onClick={()=>void run(false)}>{t.preview}</button></div>
            {success&&<p className="success" role="status">{t.downloaded}</p>}
            {(input||name||description)&&<button type="button" className="clear" onClick={clear}>{t.clear}</button>}
          </form>
        </section>
        <aside className="sidebar">
          <section className="privacy"><span className="local-icon" aria-hidden="true">↳</span><h2>{t.privacyTitle}</h2><p>{t.privacy}</p><div className="divider"/><h3>{t.offlineTitle}</h3><p>{t.offline}</p><div role="status" className={`offline-status ${offline}`}><span aria-hidden="true"/> {offline==='ready'?t.ready:offline==='error'?t.offlineError:t.loading}</div></section>
          <section className="paper-preview" aria-hidden="true"><div className="paper"><span>CLAVASTACK / UNCLE JIM</span><strong>{language==='de'?'Dein Wallet. Auf Papier.':'Your wallet. On paper.'}</strong><div className="paper-grid">{Array.from({length:24},(_,i)=><div key={i}><svg viewBox="0 0 21 21"><path d="M1 1h6v6H1zM2 2v4h4V2zM14 1h6v6h-6zM15 2v4h4V2zM1 14h6v6H1zM2 15v4h4v-4zM9 2h3v3H9zM9 7h6v2H9zM8 11h4v3H8zM14 10h6v3h-6zM11 16h3v4h-3zM16 15h4v5h-4z" fillRule="evenodd"/></svg><i>#{i+1} □</i></div>)}</div><div className="paper-cut"/><small>170 × 200 mm</small></div></section>
        </aside>
      </div>
      {wallet&&<section className="result" aria-live="polite"><h2>{t.previewTitle}</h2><p>{t.verify}</p>{!wallet.ranged&&<p className="notice">{t.fixed}</p>}{wallet.assumedPath&&<p className="notice">{t.assumed}</p>}{wallet.missingChecksum&&<p className="notice">{t.missing}</p>}<div className="address-list">{wallet.addresses.slice(0,3).map(a=><div key={a.address}><span>{a.index===null?'#1':`#${a.index}`}</span><code>{a.address}</code></div>)}</div><details><summary>{t.details}</summary><p>{t.network}: {wallet.network==='mainnet'?t.mainnet:wallet.network==='regtest'?t.regtest:t.testnet}</p><p>{t.walletType}: <code>{wallet.scriptType}</code></p><h3>{t.receive}</h3><code className="descriptor">{wallet.descriptor}</code></details></section>}
      <section className="security-note"><p><strong>{t.backupWarning}</strong></p><p>{t.security}</p></section>
      <details className="support"><summary>{t.support}</summary><p>{t.supportText}</p></details>
    </main>
    <footer><p>{t.about}</p><a href="https://github.com/Schnuartz/uncle-jim-generator">{t.credits} ↗</a></footer>
  </>;
}
