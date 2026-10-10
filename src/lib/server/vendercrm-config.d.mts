export interface HostKeyMapping { keyVariable: string; aliases?: string[] }
export interface ConfigOptions {
  env?: Record<string, string | undefined>;
  trustedHost?: string;
  hostKeyMap?: Record<string, string | HostKeyMapping>;
  singleSiteLegacyAliases?: string[];
  urlLegacyAliases?: string[];
  localTestMode?: boolean;
}
export interface SafeDiagnostics { readonly baseUrl: string; readonly leadsUrl: string; readonly keyVariable: string; readonly configured: true }
export interface ServerConfig { readonly baseUrl: string; readonly leadsUrl: string; readonly apiKey: string; readonly keyVariable: string; doctor(): SafeDiagnostics }
export function normalizeHost(authority: string): string;
export function normalizeUrl(value: string, options?: { localTestMode?: boolean; legacy?: boolean }): string;
export function resolveConfig(options?: ConfigOptions): ServerConfig;
