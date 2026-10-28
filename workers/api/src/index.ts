/**
 * Gidfine API — Cloudflare Worker Entry Point
 * Handles all REST & WebSocket requests
 */

import type { CloudflareEnv } from "./types";
import { methodNotAllowed, serverError } from "./utils/response";
import { login, register } from "./handlers/auth";
import {
  getProfile,
  updateProfile,
  listApplications,
  createApplication,
  submitApplication,
} from "./handlers/borrower";
import { getLoan, getSchedule, getTransactions, listBorrowerLoans } from "./handlers/loan";
import { submitPayment, getOutstanding } from "./handlers/payment";

// ============================================
// ROUTER
// ============================================

async function handleRequest(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // Health check
    if (path === "/health" && method === "GET") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ============================================
    // AUTH ROUTES
    // ============================================

    if (path === "/auth/register" && method === "POST") {
      return register(request, env);
    }

    if (path === "/auth/login" && method === "POST") {
      return login(request, env);
    }

    // ============================================
    // BORROWER ROUTES
    // ============================================

    if (path === "/borrower/profile" && method === "GET") {
      return getProfile(request, env);
    }

    if (path === "/borrower/profile" && method === "PUT") {
      return updateProfile(request, env);
    }

    if (path === "/borrower/applications" && method === "GET") {
      return listApplications(request, env);
    }

    if (path === "/borrower/applications" && method === "POST") {
      return createApplication(request, env);
    }

    if (path.match(/^\/borrower\/applications\/[^/]+\/submit$/) && method === "POST") {
      const appId = path.split("/")[3];
      return submitApplication(request, env, appId);
    }

    if (path === "/borrower/loans" && method === "GET") {
      return listBorrowerLoans(request, env);
    }

    // ============================================
    // LOAN ROUTES
    // ============================================

    if (path.match(/^\/loans\/[^/]+$/) && method === "GET") {
      const loanId = path.split("/")[2];
      return getLoan(request, env, loanId);
    }

    if (path.match(/^\/loans\/[^/]+\/schedule$/) && method === "GET") {
      const loanId = path.split("/")[2];
      return getSchedule(request, env, loanId);
    }

    if (path.match(/^\/loans\/[^/]+\/transactions$/) && method === "GET") {
      const loanId = path.split("/")[2];
      return getTransactions(request, env, loanId);
    }

    if (path.match(/^\/loans\/[^/]+\/outstanding$/) && method === "GET") {
      const loanId = path.split("/")[2];
      return getOutstanding(request, env, loanId);
    }

    // ============================================
    // PAYMENT ROUTES
    // ============================================

    if (path.match(/^\/loans\/[^/]+\/payments$/) && method === "POST") {
      const loanId = path.split("/")[2];
      return submitPayment(request, env, loanId);
    }

    // 404
    return new Response(JSON.stringify({ error: "Not found", code: "NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[API] Unexpected error:", error);
    return serverError();
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return handleRequest(request, env, ctx);
  },

  async queue(batch: MessageBatch<any>, env: CloudflareEnv) {
    for (const message of batch.messages) {
      try {
        console.log("[QUEUE] Processing:", message.body);
        // TODO: Handle different event types
        message.ack();
      } catch (error) {
        console.error("[QUEUE] Processing failed:", error);
        message.retry();
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: CloudflareEnv, ctx: ExecutionContext) {
    console.log("[SCHEDULED] Cron triggered:", event.cron);
    // TODO: Implement scheduled tasks (loan overdue checks, reminders, etc.)
  },
};
