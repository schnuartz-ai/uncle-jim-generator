# Contributing

Use Node 22, `npm ci`, a feature branch and a pull request. Preserve the MIT license and Specter attribution. Never add live wallet data or secrets to fixtures, screenshots or issue descriptions.

Run `npm run check`, generate PDF fixtures with `npm run samples`, and run `npm run pdf:verify` with the documented Python libraries. Changes to address generation require independent expected scriptPubKeys and addresses from official BIPs, Bitcoin Core or another implementation. Parsing success alone is not sufficient.

Keep Bitcoin logic independent of UI/PDF layout. Fail closed for unsupported descriptors. Preserve exact originals, key order, checksums, origins, network information and fixed/ranged distinctions. Add both English and German messages for every user-facing change, including PDF instructions. Maintain strict document/SW CSP separation and never add remote runtime services or telemetry.

Use exact direct dependency versions and commit the lockfile. Review advisories, licenses and changes when upgrading cryptographic dependencies. Release via semantic versioning after CI passes. See the release workflow and CHANGELOG.
