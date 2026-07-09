/** Centralized environment access for the merged (single-process) backend. */
export const env = {
  // Custodial signing is testnet-only by design.
  network: (process.env.STELLAR_NETWORK ?? "testnet") as "testnet",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "replace-me-with-a-secure-secret",
  // Comma-separated allowlist of admin emails (case-insensitive). A signed-in
  // user whose email is listed here can access the /admin dashboard.
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};
