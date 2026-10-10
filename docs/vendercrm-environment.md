# VenderCRM server environment

Configure VENDERCRM_URL as an HTTPS origin (no endpoint path) and VENDERCRM_API_KEY as this site's server-only key in the persistent Hostinger application environment. Enter the pair once; subsequent source/build redeploys of that same application reuse it. A replacement application needs its environment provisioned separately. Never put values in Git, browser bundles, logs, or an uploaded .env file. No NEXT_PUBLIC_ names.

The tracked server module validates HTTPS origins, headers and incomplete settings; an entirely absent pair leaves the optional sink disabled. Its non-enumerable apiKey accessor is for transport only; doctor(), JSON, spread and Node inspection omit the secret value. Native Node imports and the runtime guard prevent browser runtime usage. Existing payload fields, eligibility, local persistence and retry behavior are preserved. Invalid configuration fails the CRM delivery path without failing a locally captured lead.

All IP literals and local/reserved names require explicit local test mode. This is syntactic validation, not DNS-based SSRF protection. The module never loads .env.

Run npm run test:vendercrm-config for synthetic, network-free checks.

The optional consumer integration smoke test uses Node stripTypeScriptTypes (available on current Node 22+/24); older runtimes skip that one test while running the dependency-free configuration checks. The smoke test stubs fetch and persistence and never makes a real lead request. Full application typecheck/build still needs the project dependency install.
