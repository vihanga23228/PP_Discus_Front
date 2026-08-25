import { redirect } from "next/navigation";

/**
 * Superseded by app/login/page.tsx, which is wired to the API.
 * Safe to delete along with the rest of app/Component.
 */
export default function LegacyLoginPage() {
  redirect("/login");
}
