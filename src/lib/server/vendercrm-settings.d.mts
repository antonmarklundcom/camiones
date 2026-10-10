import type { ServerConfig } from './vendercrm-config.mjs';
export function optionalVenderCrmConfig(env?: Record<string, string | undefined>): ServerConfig | null;
export function venderCrmSettingsPresent(env?: Record<string, string | undefined>): boolean;
