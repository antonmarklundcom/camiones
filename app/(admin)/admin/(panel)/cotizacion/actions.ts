"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";
import { setActiveFxRate } from "@/lib/fx";
import { recomputeMoney } from "@/lib/jobs/money";

export interface FxFormState {
  error?: string;
}

/**
 * Set the active USD→PYG rate, then immediately recompute every derived ₲
 * price and cached cuota. Doing the recompute here rather than waiting for the
 * nightly cron is the point of F11: the moment the rate changes, no card is
 * still quoting the old one.
 */
export async function setFxRateAction(
  _prev: FxFormState,
  formData: FormData,
): Promise<FxFormState> {
  const user = await requireAdmin();

  const rate = Number(String(formData.get("rate") ?? "").replace(/[^\d.,]/g, "").replace(",", "."));
  if (!Number.isFinite(rate) || rate <= 0) {
    return { error: "Ingresá una cotización válida (ej. 7350)." };
  }
  if (rate < 1000 || rate > 50000) {
    // A fat-fingered rate silently rewrites the ₲ price of every listing, so
    // the sanity band is deliberately narrow around plausible ₲/US$ values.
    return {
      error: `${rate} ₲/US$ está fuera de rango (1.000–50.000). Revisá el número.`,
    };
  }

  try {
    await setActiveFxRate({
      rate,
      source: String(formData.get("source") ?? "").trim() || "manual",
      note: String(formData.get("note") ?? "").trim() || null,
      createdBy: user.id,
    });
    await recomputeMoney();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la cotización." };
  }

  revalidatePath("/admin/cotizacion");
  redirect("/admin/cotizacion?guardado=1");
}

/** Re-derive ₲ prices and cuotas without changing the rate. */
export async function recomputeMoneyAction(): Promise<void> {
  await requireAdmin();
  await recomputeMoney();
  revalidatePath("/admin/cotizacion");
  redirect("/admin/cotizacion?recalculado=1");
}
