import { resolveConfig } from './vendercrm-config.mjs';
/** Both absent disables the optional sink; a partial/invalid pair is an error. */
export function optionalVenderCrmConfig(env = process.env) {
  if (!env.VENDERCRM_URL && !env.VENDERCRM_API_KEY) return null;
  return resolveConfig({ env });
}
export function venderCrmSettingsPresent(env = process.env) {
  return Boolean(env.VENDERCRM_URL || env.VENDERCRM_API_KEY);
}
