/**
 * The lead-sink seam (Decisions Log: "Lead sink: config-chosen interface —
 * GHL / VenderCRM / email"). One interface, one env var, so a fork of this
 * template points its leads somewhere else without touching the contact form.
 *
 * Pure types + the delivery contract. No network, no DB — so the retry policy
 * that reads `DeliveryResult` is unit-testable.
 */

export interface LeadRecord {
  id: number;
  name: string;
  phone: string;
  message: string;
  listingPublicId: string | null;
  listingTitle: string | null;
  listingUrl: string | null;
  priceUsd: string | null;
  pageUrl: string | null;
  referrerHost: string | null;
  idempotencyKey: string;
  attempts: number;
}

export interface DeliveryResult {
  ok: boolean;
  /**
   * `permanent` means retrying will never help: bad credentials, a rejected
   * payload, a deactivated site. Those go straight to `failed` so the sweep
   * doesn't spend the next month re-POSTing a 422 every ten minutes.
   */
  permanent?: boolean;
  status?: number;
  detail?: string;
}

export interface LeadSink {
  /** Stored on the lead row so you can tell where a lead actually went. */
  readonly name: string;
  /** False when the env vars this sink needs are missing. */
  readonly configured: boolean;
  deliver(lead: LeadRecord): Promise<DeliveryResult>;
}

/** Max delivery attempts before a lead is parked as `failed` for a human. */
export const MAX_ATTEMPTS = 6;

/**
 * Backoff before the Nth retry, in minutes: 1, 5, 15, 60, 240. Short enough
 * that a blip self-heals within the hour, long enough that a genuinely down
 * CRM isn't hammered. The sweep runs on the cron's schedule, so these are
 * lower bounds, not promises.
 */
export function retryDelayMinutes(attempts: number): number {
  const schedule = [1, 5, 15, 60, 240];
  return schedule[Math.min(attempts, schedule.length - 1)];
}

/** Is this lead due for another delivery attempt? */
export function isDue(
  lead: { attempts: number; lastAttemptAt: Date | null },
  now: Date,
): boolean {
  if (lead.attempts >= MAX_ATTEMPTS) return false;
  if (!lead.lastAttemptAt) return true;
  const dueAt = new Date(
    lead.lastAttemptAt.getTime() + retryDelayMinutes(lead.attempts) * 60_000,
  );
  return now >= dueAt;
}

/** HTTP status → whether retrying could ever succeed. */
export function isPermanentStatus(status: number): boolean {
  // 401/403 credentials or a deactivated site, 400/422 a payload we will keep
  // sending unchanged. 429 and 5xx are worth another go.
  return status === 400 || status === 401 || status === 403 || status === 422;
}
