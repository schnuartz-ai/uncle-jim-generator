# Security policy

This is public-key-only software. It does not sign transactions or ask for seeds. Wallet input must never enter logs, URLs, analytics, localStorage, sessionStorage, IndexedDB, service-worker caches or backend requests. The only output containing wallet data is the explicitly downloaded PDF.

Extended private keys, WIF, seed phrases, bare raw private keys and secret wallet-export markers are rejected before descriptor evaluation. Detected secret paste is cleared from the field. Never expose rejected input in an error. Public x-only Taproot keys are 32 bytes and cannot mathematically be distinguished from arbitrary 32-byte integers based on text alone; they are accepted only in public descriptor contexts, never as a bare private-key import. Users must export public descriptors from trusted wallets.

Addresses must be verified on the original hardware wallet before use. A correct address derivation does not verify spending feasibility, signer access, timelocks, entropy, wallet authenticity, or the absence of malware. The PDF is not a seed backup. An XPub or PDF can reveal addresses, balances and transaction history.

The hosted generator bypasses global ClavaStack scripts and blocks fetch/WebSocket/beacon connections with `connect-src 'none'`. Local service workers are scoped and cache only public application assets. This does not protect against a malicious browser extension, compromised device, same-origin hosting operator or replacement application bundle. Use a reviewed local build disconnected from the network where stronger assurance is required.

Limits: input 8192 characters, nesting 24, expression nodes 96, public-key entries 20, address count 96, non-hardened indices only, worker evaluation 12 seconds. Unsupported constructions and unresolved networks fail closed. Font limitations produce a clear error rather than silently losing user content.

Version 1.x is supported. Report a vulnerability privately through GitHub's repository vulnerability-reporting mechanism when enabled, or contact the maintainer through the contact channel listed on ClavaStack. Do not open a public issue containing wallet data, seed words or working secrets. No independent security audit has been performed.
