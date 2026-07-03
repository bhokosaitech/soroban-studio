import Link from "next/link";

/** The 4-square Soroban Studio mark + wordmark. `variant` adapts to the bg. */
export function Logo({ href = "/", variant = "light" }: { href?: string; variant?: "light" | "dark" }) {
  const dark = variant === "dark";
  return (
    <Link href={href} className="flex items-center gap-2.5 no-underline">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          dark ? "border border-white/15 bg-white/10" : "bg-ink"
        }`}
      >
        <svg viewBox="0 0 18 18" fill="none" className="h-[18px] w-[18px]">
          <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" />
          <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.5" />
          <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.5" />
          <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" />
        </svg>
      </span>
      <span className={`font-serif text-[18px] tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        Soroban Studio
      </span>
    </Link>
  );
}
