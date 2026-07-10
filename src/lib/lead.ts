/** Shared shape between the contact-form server action and its client form. */
export interface LeadState {
  status: "idle" | "ok" | "error";
  message?: string;
}
