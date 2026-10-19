import { query } from "./_generated/server";

/**
 * Foundation Health Check Query
 * Verifies backend deployment connectivity and returns system status.
 */
export const check = query({
  args: {},
  handler: async () => {
    return {
      status: "ok",
      system: "Gidfine Convex Foundation",
      timestamp: Date.now(),
      version: "1.1.0",
    };
  },
});
