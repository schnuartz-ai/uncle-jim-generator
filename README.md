# ClavaStack Uncle Jim Generator

A public-key-only Bitcoin address-sheet generator. Paste an account XPub or a supported output descriptor, name the wallet, and download a printable PDF. German and English, entirely in the browser, with no backend, node, blockchain API or account.

Inspired by the Uncle Jim Wallet PDF functionality in Specter Desktop by the Specter contributors. Its original address sheet and separate recovery PDF were studied; this implementation was independently written. Specter's account-map QR is a distinct export format. Our recovery QR is explicitly labelled as a Bitcoin Core descriptor.

## Using it

1. Load the generator and wait for **Ready for offline use**.
2. For maximum privacy, disconnect your device from the internet manually. The application cannot prove network isolation.
3. Paste an **XPub or public output descriptor**. Never enter a seed phrase or private key.
4. Give the wallet a name and optionally a description.
5. Preview the addresses or generate the PDF. Compare the exact addresses with the original hardware wallet before receiving funds.

A bare XPub defaults to Native SegWit and `/0/*`. Both are assumptions, not facts about an exported account; select the existing wallet's address type and correct the remaining path in advanced settings. Origin paths in brackets describe derivation already performed before export. Hardened public child derivation is rejected. Recognized SLIP-132 keys carry their address convention and conflicting choices are rejected. Selecting Taproot does not convert an existing wallet into a BIP86 wallet.

An XPub is an extended **public** key: it can reveal receiving addresses and transaction history, but contains no spending key. A descriptor records the public keys and script policy used by a wallet. Neither this sheet nor an XPub replaces the seed phrase, signer backups, or full policy recovery material.

## Compatibility

| Input | Status |
| --- | --- |
| `pkh(KEY)`, `wpkh(KEY)`, `sh(wpkh(KEY))` | Supported, fixed and ranged |
| `tr(KEY)` | Supported, correct Taproot tweak, BIP86 vector tested |
| `sh(multi(...))`, `sh(sortedmulti(...))` | Supported legacy multisig |
| `wsh(multi(...))`, `wsh(sortedmulti(...))` | Supported native SegWit multisig |
| `sh(wsh(...))` | Supported nested SegWit multisig / compatible Miniscript |
| Compatible `wsh()` Miniscript | Supported by pinned parser/compiler, context validation; timelocked reference tested |
| `tr(KEY,TREE)` | Supported compatible Tapscript trees; `pk`, `multi_a`, `sortedmulti_a` independently tested |
| `/<0;1>/*`, `/**` multipath | External branch 0; exact multipath recovery text retained |
| Fixed output | One output; never invents 24 distinct addresses |
| `xpub`, `tpub` | Supported, network-family inference |
| `ypub/zpub/upub/vpub` | Supported SLIP-132 single-sig conventions |
| `Ypub/Zpub/Upub/Vpub` | Only in a matching complete multisig descriptor |
| Raw public-key descriptors | Require explicit advanced network clarification |
| XPrv, WIF, seed phrases, bare raw private keys / secret exports | Rejected, never converted to public keys |
| Arbitrary policies, unsupported syntax, secret-bearing inputs | Rejected without partial interpretation |

Support means local scriptPubKey/address generation, **not a proof that all spending conditions can be satisfied**. Some syntactically valid Miniscript constructions are outside the library's supported script contexts; they fail closed. No general-purpose policy language, MuSig protocol, transaction signing, wallet scanning or balance lookup is offered.

Mainnet and the common test-network family are inferred from extended-key serialization. Testnet3, Testnet4 and Signet share address/key encodings and cannot be distinguished from an XPub alone. Regtest is available through advanced clarification. Mixed mainnet/testnet keys and conflicting overrides are rejected. No network is silently invented for raw-key input.

## PDF and printing

The default is A4 portrait with indices **1–24**, three columns and eight rows. A large QR in the upper-right corner contains the checksummed receive descriptor and is labelled **Watch-Only**. Advanced settings permit index 0 and up to 96 addresses, with additional address pages. Every QR contains its exact address or descriptor and has a quiet zone. Verification boxes start empty.

Print at **100% / actual size**, then trim **all four dotted edges** around the retained **170 × 200 mm** sheet. Removing only the bottom strip leaves A4 too wide. This provides 10 mm dimensional clearance in a published 180 × 210 mm Debasafe bag. PDFs have been rendered and measured; physical printer scaling still depends on your print settings.

The removable instruction strip contains no wallet-specific data. Product QRs link directly to the localized Debasafe and Backup Stack pages without tracking redirects. Keep every recovery page. Recovery pages preserve the exact original input, full effective checksummed descriptor, supplied change descriptor, key origins, fingerprints and remaining paths. Long descriptions and recovery material paginate. If a descriptor cannot fit at a reliable printed QR module size, the PDF keeps its complete text and explains that the QR is omitted.

Noto Sans is embedded for offline, selectable print text. Latin, Greek and Cyrillic are supported; unsupported glyphs, including emoji/CJK not present in this font, produce an explicit error instead of disappearing. Wallet names are limited to 80 characters and descriptions to 1000. Safe filenames are computed separately from document content.

## Development

Node **22.18 or newer** recommended (dependencies require at least 20.19).

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Vite uses the production base `/uncle-jim-generator/`. For development visit that path. `npm run build` produces `dist/`, including locale documents, versioned assets, manifest and narrowly scoped service workers. `npm ci` prepares the embedded fonts from checked-in OFL font sources; no runtime font fetch is required.

Generate reproducible public-vector samples and verify the real rendered outputs:

```sh
npm run samples
python -m pip install pypdf pypdfium2 pdfplumber
npm run pdf:verify
```

Fixtures use published test keys only. The PDF checks extract complete addresses and descriptors, validate A4 bounds and the exact trim rectangle, render each page, and decode address and product QRs independently with jsQR. Browser tests generate PDFs offline, reload both locale paths, switch language, reject secrets, check storage/network isolation, and verify mobile overflow. See `docs/VALIDATION.md` for release evidence.

## Architecture and reuse

`src/bitcoin/engine.ts` wraps the pinned BitcoinerLAB descriptor parser/compiler and bitcoinjs BIP32/Taproot implementation. A fresh Web Worker bounds evaluation time and is terminated after each request. `src/pdf/generator.ts` consumes a plain public wallet model and creates a PDF with jsPDF and local vector QRs. React handles the form; translation dictionaries and fonts are bundled.

The standalone repository is the canonical source. Third parties can build and host this static application without Next.js, ClavaStack or any backend. Import the TypeScript engine and PDF module if embedding them in another bundler, keeping the same security controls. Do not copy the derivation engine into the website repository. See `docs/ARCHITECTURE.md` and `docs/CLAVASTACK.md` for library decisions and same-origin deployment.

## Privacy and offline behavior

The isolated generator document has `connect-src 'none'`, no analytics and no remote fonts. Wallet data lives in component/worker memory only; no input is sent to the server, stored in browser storage, URL parameters or logs. Downloaded PDFs remain sensitive public-wallet information.

Service workers precache only an explicit list of app resources and both language documents. Their separate `connect-src 'self'` permits static precaching. EN and DE scopes are `/uncle-jim-generator` and `/de/uncle-jim-generator`; exact path filtering prevents interception of unrelated tools, checkout or shop pages. Active clients keep their current version until tabs close. Old caches are retained to avoid mixing an existing document with newer engine files. To update, reconnect, close all generator tabs and reopen. Browser storage eviction can remove offline readiness; load again online if that happens. A first visit cannot work offline.

An operator able to modify the hosted application can change what it does. For stronger assurance, build a reviewed version locally, serve it on localhost, load it, then disconnect. See `SECURITY.md`. No software security audit or physical printing test is implied by the automated checks.

## Open source

MIT license, original `Copyright (c) 2026 Schnuartz` preserved unchanged. See `THIRD_PARTY_NOTICES.md` for attribution and font licenses, `CONTRIBUTING.md` for changes and reference-vector requirements, `SECURITY.md` for reporting, and `CHANGELOG.md` for version history.

Primary references: [Specter original PDF source](https://github.com/cryptoadvance/specter-desktop/blob/master/src/cryptoadvance/specter/templates/wallet/components/wallet_pdf.jinja), [BitcoinerLAB descriptor documentation](https://bitcoinerlab.com/modules/descriptors), [Bitcoin Core descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md), [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki), [BIP86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki).
