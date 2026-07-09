/** Centralized environment access for the merged (single-process) backend. */
export const env = {
  // Custodial signing is testnet-only by design.
  network: (process.env.STELLAR_NETWORK ?? "testnet") as "testnet",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "replace-me-with-a-secure-secret",
};
