"use client";
import { useFormStatus } from "react-dom";

/** Submit button that asks for confirmation before letting the form submit. */
export function ConfirmSubmit({
  children,
  message,
  className = "",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={className}
    >
      {children}
    </button>
  );
}

/** Submit button that disables + relabels itself while the form action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  className = "",
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  const base =
    "inline-flex h-11 items-center justify-center rounded-lg px-5 font-heading font-bold transition-colors disabled:opacity-60";
  const styles = {
    primary: "bg-amber-brand text-charcoal-950 hover:bg-amber-deep",
    ghost: "border border-charcoal-100 bg-white text-ink hover:bg-charcoal-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button type="submit" disabled={pending} className={`${base} ${styles} ${className}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
