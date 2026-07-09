"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Minimal typing for the Google Identity Services global we use. */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (res: { credential?: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

export function LoginForm({ clientId, next }: { clientId: string; next: string }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    async function onCredential(res: { credential?: string }) {
      if (!res.credential) return;
      setBusy(true);
      setError(null);
      try {
        const r = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken: res.credential }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Sign-in failed.");
        router.replace(next);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    }

    function init() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "center",
        width: 320,
      });
    }

    // Load the GIS script once, then initialize.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing && window.google) {
      init();
    } else if (existing) {
      existing.addEventListener("load", init, { once: true });
    } else {
      const s = document.createElement("script");
      s.src = GSI_SRC;
      s.async = true;
      s.defer = true;
      s.addEventListener("load", init, { once: true });
      document.head.appendChild(s);
    }
  }, [clientId, next, router]);

  if (!clientId) {
    return (
      <div className="rounded-xl border border-border bg-off px-4 py-3 text-[13px] text-muted">
        Google sign-in isn&apos;t configured. Set <code className="font-mono">GOOGLE_CLIENT_ID</code>{" "}
        in your environment to enable it.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={buttonRef} className={busy ? "pointer-events-none opacity-60" : ""} />
      {busy && <p className="text-[13px] text-muted">Signing you in…</p>}
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
