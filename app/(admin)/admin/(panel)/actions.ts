"use server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}
