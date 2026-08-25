import { redirect } from "next/navigation";

/**
 * Superseded. The home page now lives at app/page.tsx and shared UI lives in
 * app/components/. This folder only remains so the old /Component/HomePage URL
 * does not 404 — it is safe to delete the whole app/Component directory.
 */
export default function LegacyHomePage() {
  redirect("/");
}
