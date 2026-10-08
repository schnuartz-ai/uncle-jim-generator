# Changelog

## 1.1.2 — 2026-10-08

- Reflowed the 24-address sheet to four QR codes per row across six rows while keeping each address, index and verification checkbox with its QR.

## 1.1.1 — 2026-10-08

- Added the ClavaStack Security identity to the generator header and clarified its watch-only PDF output in English and German.
- Keep offline cache and PDF creator metadata aligned with the package version.

## 1.1.0 — 2026-10-08

- Redesigned the printable sheet with a short brand underline, a large checksummed receive-descriptor QR labelled Watch-Only, and a compact three-column/eight-row address grid.
- Kept the complete original and effective descriptors as selectable text on the recovery pages; verifies the rendered descriptor QR alongside every address QR.

## 1.0.0 — 2026-10-08

- Public-only XPub/descriptor import, local BIP32 derivation, single-sig and multisig, compatible WSH Miniscript/Taproot trees, SLIP-132 and test networks.
- German/English React UI with address preview, advanced derivation settings, strict validation and worker limits.
- A4 printable address grids, exact 170 × 200 mm trimming outline, empty verification boxes, recovery details and detachable localized instructions/product QRs.
- Embedded OFL fonts, local vector QR rendering, application-scoped offline precaching and no wallet persistence.
- Independent BIP/scure reference tests, PDF rendering/QR verification, offline browser tests, CI, contribution/security documentation.
- Static ClavaStack integration contract with privacy isolation and short URL aliases.
