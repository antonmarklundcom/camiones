/**
 * F4 — the scheduled-job endpoint.
 *
 * Hostinger's managed Node.js slots give you a fixed, small number of cron
 * entries and no way to see whether one actually ran, so the Decisions Log
 * chose a guarded route handler hit by an external pinger instead
 * (docs/cron.md has the setup). One URL, one secret, a JSON result you can
 * read in the pinger's own log.
 *
 *   GET|POST /api/cron?job=all
 *   Authorization: Bearer $CRON_SECRET      (or ?token=$CRON_SECRET)
 *
 * Anything without a valid secret gets a bare 401 — no hint that the route
 * exists, no work done. With CRON_SECRET unset the route refuses everything
 * (503): an unguarded job endpoint on a public host is not an acceptable
 * default, and failing closed is louder than failing open.
 */
import { NextResponse } from "next/server";
import { recomputeMoney, sweepLeads } from "@/lib/jobs/money";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Shared Hostinger MySQL: the recompute walks every listing, so give it room.
export const maxDuration = 60;

const JOBS = ["all", "cuotas", "leads"] as const;
type Job = (typeof JOBS)[number];

function authorize(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET no está configurado (mínimo 16 caracteres). El endpoint " +
          "de cron queda deshabilitado hasta que lo definas.",
      },
      { status: 503 },
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null;
  const token = bearer ?? new URL(req.url).searchParams.get("token");

  if (!token || !timingSafeEqual(token, secret)) {
    return new NextResponse(null, { status: 401 });
  }
  return null;
}

/** Constant-time compare — a plain === leaks the secret one byte at a time. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function run(req: Request): Promise<NextResponse> {
  const denied = authorize(req);
  if (denied) return denied;

  const raw = new URL(req.url).searchParams.get("job") ?? "all";
  if (!(JOBS as readonly string[]).includes(raw)) {
    return NextResponse.json(
      { ok: false, error: `job desconocido '${raw}' (usá: ${JOBS.join(", ")})` },
      { status: 400 },
    );
  }
  const job = raw as Job;
  const startedAt = Date.now();

  try {
    const money =
      job === "all" || job === "cuotas" ? await recomputeMoney() : null;
    const leads = job === "all" || job === "leads" ? await sweepLeads() : null;

    return NextResponse.json({
      ok: true,
      job,
      durationMs: Date.now() - startedAt,
      money,
      leads,
    });
  } catch (e) {
    // 500 so the pinger's own failure alerting fires — a cron that silently
    // returns 200 while doing nothing is the failure mode F4 is about.
    console.error("[cron] job failed", e);
    return NextResponse.json(
      {
        ok: false,
        job,
        durationMs: Date.now() - startedAt,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
