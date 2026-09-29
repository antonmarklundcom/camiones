import "server-only";
import type sharpType from "sharp";

let loaded: typeof sharpType | null = null;

/**
 * The one way to get sharp. Loaded lazily (only upload paths need it) and
 * pinned to one libvips thread per image: on Hostinger shared hosting every
 * thread counts against the account-wide 200 "Max Processes" cap, and sharp's
 * default is one thread per visible CPU core of the whole host whenever
 * MALLOC_ARENA_MAX or jemalloc is present. Same fix as moto and propia.node.
 */
export async function loadSharp(): Promise<typeof sharpType> {
  if (!loaded) {
    loaded = (await import("sharp")).default;
    loaded.concurrency(1);
  }
  return loaded;
}
