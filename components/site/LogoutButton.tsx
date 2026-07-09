"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

/** Signs the user out by clearing the session cookie, then routes to /login. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* clear client state regardless */
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="btn-ghost flex items-center gap-1.5 disabled:opacity-40"
      title="Sign out"
    >
      <LogOut size={15} /> {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
