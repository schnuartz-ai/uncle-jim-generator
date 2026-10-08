# Architecture decision — 2026-10-08

Choose a standalone static React/TypeScript application served before the ClavaStack Next.js layouts. The live site loads global analytics and shop scripts. A native React package within that layout would allow unrelated JavaScript access to privacy-sensitive wallet input. A custom Cloudflare/OpenNext routing wrapper serves the canonical static build with a strict CSP under the existing domain, without an iframe, extra backend or new infrastructure.

## Libraries evaluated

| Candidate | Decision |
| --- | --- |
| bitcoinjs-lib / bip32 | Mature browser-ready BIP32/payment primitives, MIT; no descriptor parser on their own |
| @scure/btc-signer / @scure/bip32 | Audited minimal primitives, browser/offline friendly, MIT; used as an independent address/script reference in tests |
| @bitcoinerlab/descriptors 3.2.0 | Selected standards-oriented parser/compiler with Miniscript, Taproot trees and multipath; browser-ready bitcoinjs preset, MIT; no WASM runtime requirement |
| @bitcoinerlab/descriptors-scure | Considered alternate preset, same descriptor compiler; not independent enough to validate descriptor semantics by itself |
| Rust/WASM descriptor engines | Capable alternatives, but WASM loading and build/size complexity unnecessary for the implemented support envelope |
| jsPDF 4.2.1 / qrcode 1.5.4 | Local millimeter geometry, embedded fonts, selectable text; exact local QR matrices rendered as vector squares |

The compiler and cryptographic libraries are dependencies, not independently audited by this project. Every direct version is exact and the npm lockfile pins transitive resolution. The local production dependency audit reported no known npm advisories at validation time. This is not a guarantee against unknown flaws.

Official BIP32 and BIP86 vectors establish the base derivation and Taproot tweak. scure reference payments check all four single-sig families, legacy/native/nested multisig, a timelocked WSH script and Taproot script trees. Key ordering semantics, checksums, fixed outputs, test-family inference and SLIP-132 behavior have explicit tests.

Input preflight checks secrets, length, nesting and node counts. It does not interpret descriptor grammar. The pinned library handles grammar, script context and derivation. Upstream exceptions are discarded because they can echo input. A Web Worker with a 12-second timeout bounds processing; address count is limited to 96, key count to 20 and input to 8192 characters.

PDF layout is independent of the Bitcoin model. It preserves exact source semantics on recovery pages and never puts wallet data on discardable marketing areas. Static descriptor QR length is capped at 450 characters; exact text is always retained.

The main bundle includes print font data and the complete local pipeline. A larger initial download is an intentional tradeoff for offline generation and `connect-src 'none'`. Runtime split chunks and the worker are precached. Deployment builds must not apply ordinary ClavaStack analytics, external fonts or shop layout scripts to this document.
