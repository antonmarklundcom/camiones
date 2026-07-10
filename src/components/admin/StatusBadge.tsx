import { LISTING_STATUS_LABELS, type ListingStatus } from "@/lib/admin/constants";

const STYLES: Record<ListingStatus, string> = {
  published: "bg-green-100 text-green-800",
  draft: "bg-amber-soft text-amber-deep",
  paused: "bg-charcoal-100 text-ink-soft",
  sold: "bg-blue-100 text-blue-800",
  removed: "bg-red-100 text-red-700",
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}
    >
      {LISTING_STATUS_LABELS[status]}
    </span>
  );
}

export function PublishBadge({ status }: { status: "draft" | "published" }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        status === "published"
          ? "bg-green-100 text-green-800"
          : "bg-amber-soft text-amber-deep"
      }`}
    >
      {status === "published" ? "Publicado" : "Borrador"}
    </span>
  );
}
