# ClavaStack integration contract

Canonical upstream: `https://github.com/Schnuartz/uncle-jim-generator`.

Build with `npm ci && npm run build`, then import the committed version's `dist/` into the website using the validating sync script maintained in `next-clavastack`. The website records version, upstream commit and file SHA-256 values in its integration manifest. Generated build artifacts are copied; Bitcoin source is not duplicated.

Documents:

- `/uncle-jim-generator` and `/uncle-jim-generator/`: English document.
- `/de/uncle-jim-generator` and its slash variant: German document from `dist/de/index.html`.
- Shared assets: `/uncle-jim-generator/assets/*`, local public assets and fonts.
- Service workers: `/uncle-jim-generator/sw.js` and `/de/uncle-jim-generator/sw.js`; the latter is the same bundled worker.
- Redirect aliases: `/uncle-jim-pdf-generator`, `/uncle-jim-pdf`, `/uncle-gym-generator`, with equivalent `/de/` aliases.

The Cloudflare wrapper must serve the HTML before OpenNext/Next middleware and layouts. Rewriting inside an ordinary React page is insufficient because global scripts already execute there. Development middleware must likewise rewrite to the raw static document.

Application CSP:

```text
default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; worker-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'
```

SW responses need `Service-Worker-Allowed` equal to the slashless corresponding scope and a separate CSP: `default-src 'none'; script-src 'self'; connect-src 'self'`. They fetch only the explicit app manifest; no input is messaged to or cached by them. Do not force an update over active generator clients. Keep old immutable build assets/caches long enough for existing tabs. Other same-origin tools must not delete the generator cache namespace.

Locale detection uses the document URL at startup. Language buttons switch the already-bundled dictionaries in memory so switching offline preserves the entered wallet. Navigation links adapt to the selected language. Reloading `/de/uncle-jim-generator` starts in German without storing a language preference or wallet input.

Tool navigation goes to `/tools` / `/de/tools`; menu links point to `/security-talk` and `/uncle-jim-wallet`. The standalone page shares the ClavaStack logo and Sora/DM Sans brand typography, bundled locally under OFL licenses.

Deploy from the website's feature-branch/PR workflow and existing GitHub Actions Cloudflare deployment. Use only the authorized non-main GitHub account. Do not read `.env` files to deploy. After publication test both locale routes, aliases, CSP, empty storage, offline refresh and a locally generated test-vector PDF on the actual production origin.
