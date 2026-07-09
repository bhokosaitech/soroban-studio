/** Centralized, validated environment access. */
export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim()),
  // Custodial signing is testnet-only by design.
  network: (process.env.STELLAR_NETWORK ?? "testnet") as "testnet",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "replace-me-with-a-secure-secret",
};
