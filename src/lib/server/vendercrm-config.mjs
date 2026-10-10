// Server-only configuration. No dotenv loading, transport, or secret persistence.
import { inspect } from 'node:util';
import { isIP } from 'node:net';
if (typeof process === 'undefined' || !process.versions?.node || typeof window !== 'undefined') {
  throw new Error('VENDERCRM configuration requires a Node server runtime');
}
const fail = message => { throw new Error(message); };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const envName = name => typeof name === 'string' && /^[A-Z][A-Z0-9_]*$/.test(name);

export function normalizeHost(authority) {
  if (typeof authority !== 'string' || !authority || authority.trim() !== authority || /[\s,@/\\?#]/.test(authority)) fail('Invalid host authority');
  const match = authority.match(/^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?$/i);
  if (!match || (match[2] && (+match[2] < 1 || +match[2] > 65535))) fail('Invalid host authority');
  const host = match[1].toLowerCase();
  if (host.length > 253 || host.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) fail('Invalid host authority');
  return host;
}

function privateHost(host) {
  host = host.replace(/\.$/, ""); // DNS root dot cannot bypass local-name rejection.
  // Conservative literal policy: even public IP literals require local test mode.
  return !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
    || !!isIP(host.replace(/^\[|\]$/g, '')) || /^[0-9.]+$/.test(host);
}

export function normalizeUrl(value, { localTestMode = false, legacy = false } = {}) {
  if (typeof value !== 'string' || value.trim() !== value || !value || /[\\\s@]/.test(value)) fail('Invalid VENDERCRM URL');
  let url;
  try { url = new URL(value); } catch { fail('Invalid VENDERCRM URL'); }
  if (url.port && (+url.port < 1 || +url.port > 65535)) fail('Invalid VENDERCRM URL');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || value.includes('?') || value.includes('#')) fail('Invalid VENDERCRM URL');
  const path = url.pathname;
  if (path !== '/' && !(legacy && path === '/api/v1/leads')) fail('VENDERCRM URL must be an HTTPS origin');
  // Check raw paths too: URL parsing must not silently resolve dot segments.
  const raw = value.match(/^https:\/\/[^/]+(\/.*)?$/i);
  if (!raw || (raw[1] && raw[1] !== '/' && !(legacy && raw[1] === '/api/v1/leads'))) fail('VENDERCRM URL must be an HTTPS origin');
  if (!localTestMode && privateHost(url.hostname)) fail('Private VENDERCRM URL is not allowed');
  return url.origin;
}

function read(env, primary, aliases = []) {
  if (!envName(primary) || aliases.some(name => !envName(name))) fail('Invalid environment variable mapping');
  const present = [primary, ...aliases].filter(name => own(env, name));
  if (!present.length) fail('Missing VENDERCRM environment setting');
  const values = present.map(name => env[name]);
  if (values.some(value => typeof value !== 'string' || !value.trim() || /[\x00-\x1f\x7f-\uffff]/.test(value))) fail('Empty or unsafe VENDERCRM environment setting');
  if (values.some(value => value !== values[0])) fail('Conflicting VENDERCRM environment settings');
  return values[0];
}

export function resolveConfig(options = {}) {
  const { env = process.env, trustedHost, hostKeyMap, singleSiteLegacyAliases = [], urlLegacyAliases = [], localTestMode = false } = options;
  if (own(options, 'siteKey')) fail('Client siteKey is not accepted');
  const urlNames = ['VENDERCRM_URL', ...urlLegacyAliases];
  if (urlLegacyAliases.some(name => !envName(name))) fail('Invalid environment variable mapping');
  const urls = urlNames.filter(name => own(env, name)).map(name => normalizeUrl(env[name], { localTestMode, legacy: name !== 'VENDERCRM_URL' }));
  if (!urls.length) fail('Missing VENDERCRM URL');
  if (urls.some(url => url !== urls[0])) fail('Conflicting VENDERCRM URLs');
  let keyVariable = 'VENDERCRM_API_KEY';
  let aliases = singleSiteLegacyAliases;
  if (hostKeyMap !== undefined) {
    if (!hostKeyMap || typeof hostKeyMap !== 'object' || Array.isArray(hostKeyMap) || !Object.keys(hostKeyMap).length) fail('Invalid host allowlist');
    const map = Object.create(null);
    for (const [host, mapping] of Object.entries(hostKeyMap)) {
      if (normalizeHost(host) !== host.toLowerCase() || host.includes(':')) fail('Allowlist entries must be host names');
      const normalized = normalizeHost(host);
      if (own(map, normalized)) fail('Duplicate allowlist host');
      const spec = typeof mapping === 'string' ? { keyVariable: mapping, aliases: [] } : mapping;
      if (!spec || !envName(spec.keyVariable) || !Array.isArray(spec.aliases ?? []) || (spec.aliases ?? []).some(name => !envName(name))) fail('Invalid environment variable mapping');
      map[normalized] = spec;
    }
    const host = normalizeHost(trustedHost);
    if (!own(map, host)) fail('Host is not allowed');
    keyVariable = map[host].keyVariable;
    aliases = map[host].aliases ?? [];
  }
  if (!Array.isArray(aliases)) fail('Invalid environment variable mapping');
  const apiKey = read(env, keyVariable, aliases);
  const safe = Object.freeze({ baseUrl: urls[0], leadsUrl: `${urls[0]}/api/v1/leads`, keyVariable, configured: true });
  const config = { baseUrl: safe.baseUrl, leadsUrl: safe.leadsUrl, keyVariable };
  Object.defineProperties(config, {
    apiKey: { get: () => apiKey, enumerable: false },
    doctor: { value: () => safe, enumerable: false },
    [inspect.custom]: { value: () => safe, enumerable: false }
  });
  return Object.freeze(config);
}
