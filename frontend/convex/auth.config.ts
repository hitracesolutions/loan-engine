/**
 * Convex Auth Configuration
 * 
 * Configures JWT verification provider (e.g. Clerk / Auth0).
 * Keep secrets out of source control.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_AUTH_ISSUER_DOMAIN ?? "https://auth.gidfine.com",
      applicationID: "convex",
    },
  ],
};
