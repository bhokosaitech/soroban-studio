import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site/Logo";
import { LoginForm } from "@/components/site/LoginForm";
import { getSessionUser } from "@/lib/server/auth";
import { env } from "@/lib/server/env";

export const dynamic = "force-dynamic";

/** Only allow internal, single-slash paths as the post-login destination. */
function safeNext(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNext(next);

  // Already signed in → skip the login screen.
  const user = await getSessionUser().catch(() => null);
  if (user) redirect(dest);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-off px-6 text-ink">
      {/* Cinematic backdrop */}
      <div aria-hidden className="grain pointer-events-none absolute inset-0">
        <div className="aurora" />
      </div>

      {/* Full-height vertical rails framing the content column (matches landing) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex justify-center">
        <div className="h-full w-full max-w-6xl border-x border-border" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-3xl border border-border bg-white/80 p-8 backdrop-blur">
          <h1 className="display text-center text-[28px]">Sign in to continue</h1>
          <p className="mx-auto mt-2 max-w-xs text-center text-[14px] leading-relaxed text-muted">
            The studio runs real workflows on Stellar. Sign in to open it.
          </p>

          <div className="mt-7 flex justify-center">
            <LoginForm clientId={env.googleClientId} next={dest} />
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-muted">
          <Link href="/" className="underline-offset-4 transition-colors hover:text-ink hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
