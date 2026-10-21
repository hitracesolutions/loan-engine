import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateLedgerEntrySchema,
  validateDisbursementRequestSchema,
  validateMakerCheckerSegregation,
  isValidIdempotencyKey,
  evaluateIdempotencyPayloadMatch,
  VALID_LEDGER_ENTRY_TYPES,
  VALID_DISBURSEMENT_STATUSES,
  VALID_DISBURSEMENT_CHANNELS,
} from "../convex/lib/ledgerTypes.ts";

describe("Phase 4A: Financial Ledger Schema & Idempotency Foundations", () => {
  describe("Ledger Entries Schema Validation", () => {
    it("accepts valid ledger entry with positive integer pesewas and GHS currency", () => {
      const validEntry = {
        agencyId: "agencies_1",
        applicationId: "applications_1",
        entryType: "DISBURSEMENT",
        amountPesewas: 500000, // GHS 5,000.00
        currency: "GHS",
        actorId: "users_cashier1",
      };
      const result = validateLedgerEntrySchema(validEntry);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.error, undefined);
    });

    it("rejects non-integer, zero, or negative amounts", () => {
      const floatEntry = {
        agencyId: "agencies_1",
        applicationId: "applications_1",
        entryType: "DISBURSEMENT",
        amountPesewas: 5000.5,
        currency: "GHS",
        actorId: "users_cashier1",
      };
      assert.strictEqual(validateLedgerEntrySchema(floatEntry).isValid, false);

      const zeroEntry = { ...floatEntry, amountPesewas: 0 };
      assert.strictEqual(validateLedgerEntrySchema(zeroEntry).isValid, false);

      const negEntry = { ...floatEntry, amountPesewas: -1000 };
      assert.strictEqual(validateLedgerEntrySchema(negEntry).isValid, false);
    });

    it("rejects invalid currencies", () => {
      const invalidCurrency = {
        agencyId: "agencies_1",
        applicationId: "applications_1",
        entryType: "DISBURSEMENT",
        amountPesewas: 500000,
        currency: "USD",
        actorId: "users_cashier1",
      };
      const result = validateLedgerEntrySchema(invalidCurrency);
      assert.strictEqual(result.isValid, false);
      assert.match(result.error ?? "", /Invalid currency/);
    });

    it("validates all approved ledger entry types", () => {
      for (const entryType of VALID_LEDGER_ENTRY_TYPES) {
        const entry = {
          agencyId: "agencies_1",
          applicationId: "applications_1",
          entryType,
          amountPesewas: 100000,
          currency: "GHS",
          actorId: "users_cashier1",
          isReversal: entryType === "REVERSAL",
          reversedEntryId: entryType === "REVERSAL" ? "ledgerEntries_orig" : undefined,
        };
        assert.strictEqual(validateLedgerEntrySchema(entry).isValid, true);
      }
    });

    it("rejects unapproved ledger entry types", () => {
      const badEntry = {
        agencyId: "agencies_1",
        applicationId: "applications_1",
        entryType: "UNKNOWN_TYPE",
        amountPesewas: 100000,
        currency: "GHS",
        actorId: "users_cashier1",
      };
      const result = validateLedgerEntrySchema(badEntry);
      assert.strictEqual(result.isValid, false);
      assert.match(result.error ?? "", /Invalid entryType/);
    });

    it("enforces reversal integrity: requiring reversedEntryId when isReversal is true", () => {
      const missingReversedRef = {
        agencyId: "agencies_1",
        applicationId: "applications_1",
        entryType: "REVERSAL",
        amountPesewas: 500000,
        currency: "GHS",
        actorId: "users_cashier1",
        isReversal: true,
      };
      const result = validateLedgerEntrySchema(missingReversedRef);
      assert.strictEqual(result.isValid, false);
      assert.match(result.error ?? "", /reversedEntryId must be provided/);
    });
  });

  describe("Disbursement Request Schema & Maker-Checker Validation", () => {
    it("accepts valid disbursement request with all required fields", () => {
      const validRequest = {
        agencyId: "agencies_1",
        applicationId: "applications_1",
        amountPesewas: 500000,
        currency: "GHS",
        makerId: "users_cashier1",
        idempotencyKey: "idem_req_001",
        channel: "MOMO",
      };
      const result = validateDisbursementRequestSchema(validRequest);
      assert.strictEqual(result.isValid, true);
    });

    it("rejects disbursement requests without idempotency key", () => {
      const missingIdempotency = {
        agencyId: "agencies_1",
        applicationId: "applications_1",
        amountPesewas: 500000,
        currency: "GHS",
        makerId: "users_cashier1",
        idempotencyKey: "",
      };
      const result = validateDisbursementRequestSchema(missingIdempotency);
      assert.strictEqual(result.isValid, false);
      assert.match(result.error ?? "", /Invalid idempotencyKey/);
    });

    it("validates disbursement channels", () => {
      for (const channel of VALID_DISBURSEMENT_CHANNELS) {
        const req = {
          agencyId: "agencies_1",
          applicationId: "applications_1",
          amountPesewas: 500000,
          currency: "GHS",
          makerId: "users_cashier1",
          idempotencyKey: `idem_${channel}`,
          channel,
        };
        assert.strictEqual(validateDisbursementRequestSchema(req).isValid, true);
      }

      const invalidChannel = {
        agencyId: "agencies_1",
        applicationId: "applications_1",
        amountPesewas: 500000,
        currency: "GHS",
        makerId: "users_cashier1",
        idempotencyKey: "idem_bad",
        channel: "BITCOIN",
      };
      assert.strictEqual(validateDisbursementRequestSchema(invalidChannel).isValid, false);
    });

    it("strictly enforces Maker-Checker segregation of duties: maker cannot approve own request", () => {
      const makerId = "users_cashier1";
      const checkerIdSame = "users_cashier1";
      const checkerIdDifferent = "users_underwriter2";

      // Same user attempting to check/approve
      const violationResult = validateMakerCheckerSegregation(makerId, checkerIdSame);
      assert.strictEqual(violationResult.isValid, false);
      assert.match(violationResult.error ?? "", /Segregation of duties violation/);

      // Distinct users
      const validResult = validateMakerCheckerSegregation(makerId, checkerIdDifferent);
      assert.strictEqual(validResult.isValid, true);
    });
  });

  describe("Idempotency Foundation & Query Simulation", () => {
    // In-memory simulation of Convex index query
    const mockDb: Array<{
      _id: string;
      agencyId: string;
      applicationId: string;
      amountPesewas: number;
      currency: string;
      idempotencyKey: string;
      status: string;
      makerId: string;
    }> = [];

    function queryByIdempotency(agencyId: string, idempotencyKey: string) {
      return mockDb.find(
        (doc) => doc.agencyId === agencyId && doc.idempotencyKey === idempotencyKey
      ) ?? null;
    }

    it("returns null for new idempotency keys and finds existing requests on retry", () => {
      const agencyId = "agencies_tenantA";
      const idempotencyKey = "tx_client_retry_uuid_12345";

      // Initial lookup returns null
      const initialLookup = queryByIdempotency(agencyId, idempotencyKey);
      assert.strictEqual(initialLookup, null);

      // Simulate insertion within transaction
      const newDoc = {
        _id: "disbursementRequests_1",
        agencyId,
        applicationId: "applications_1",
        amountPesewas: 350000,
        currency: "GHS",
        idempotencyKey,
        status: "PENDING_APPROVAL",
        makerId: "users_cashier1",
      };
      mockDb.push(newDoc);

      // Subsequent retry with identical idempotencyKey under same agency returns existing record
      const retryLookup = queryByIdempotency(agencyId, idempotencyKey);
      assert.notStrictEqual(retryLookup, null);
      assert.strictEqual(retryLookup?._id, "disbursementRequests_1");
      assert.strictEqual(retryLookup?.amountPesewas, 350000);
    });

    it("maintains agency isolation: identical idempotency keys in different agencies do not collide", () => {
      const agencyA = "agencies_tenantA";
      const agencyB = "agencies_tenantB";
      const sharedKey = "daily_batch_req_001";

      mockDb.push({
        _id: "disbursementRequests_A1",
        agencyId: agencyA,
        applicationId: "applications_A1",
        amountPesewas: 100000,
        currency: "GHS",
        idempotencyKey: sharedKey,
        status: "PENDING_APPROVAL",
        makerId: "users_cashierA",
      });

      // Agency B querying with same key does not see Agency A's request
      const lookupB = queryByIdempotency(agencyB, sharedKey);
      assert.strictEqual(lookupB, null);

      // Agency A querying finds its own request
      const lookupA = queryByIdempotency(agencyA, sharedKey);
      assert.notStrictEqual(lookupA, null);
      assert.strictEqual(lookupA?._id, "disbursementRequests_A1");
    });

    /**
     * F-04: Idempotency Payload-Mismatch Contract
     *
     * LIMITATION NOTE: This test validates the pure TypeScript contract helper for
     * idempotency payload equivalence. It does not execute a live Convex mutation or
     * prove Convex database concurrency safety, as full mutation logic is strictly
     * deferred to Phase 4B.
     */
    it("rejects payload mismatch when reusing existing idempotency key with different amount or application", () => {
      const existing = {
        amountPesewas: 500000, // GHS 5,000.00
        applicationId: "applications_loan1",
      };

      // Identical retry: matches
      const identicalRetry = {
        amountPesewas: 500000,
        applicationId: "applications_loan1",
      };
      const matchResult = evaluateIdempotencyPayloadMatch(existing, identicalRetry);
      assert.strictEqual(matchResult.isMatch, true);
      assert.strictEqual(matchResult.error, undefined);

      // Mismatched amount: contract violation
      const alteredAmount = {
        amountPesewas: 600000, // GHS 6,000.00
        applicationId: "applications_loan1",
      };
      const amountMismatch = evaluateIdempotencyPayloadMatch(existing, alteredAmount);
      assert.strictEqual(amountMismatch.isMatch, false);
      assert.match(amountMismatch.error ?? "", /mismatched amount/);

      // Mismatched loan application: contract violation
      const alteredApp = {
        amountPesewas: 500000,
        applicationId: "applications_loan2",
      };
      const appMismatch = evaluateIdempotencyPayloadMatch(existing, alteredApp);
      assert.strictEqual(appMismatch.isMatch, false);
      assert.match(appMismatch.error ?? "", /mismatched applicationId/);
    });

    /**
     * F-02: Missing/Undefined Idempotency Key Guard
     *
     * Ensures records without an idempotency key (or with undefined/null) are never
     * accidentally treated as a valid shared key or queried as a match.
     */
    it("guards against treating undefined, null, or empty string as valid idempotency keys", () => {
      assert.strictEqual(isValidIdempotencyKey(undefined), false);
      assert.strictEqual(isValidIdempotencyKey(null), false);
      assert.strictEqual(isValidIdempotencyKey(""), false);
      assert.strictEqual(isValidIdempotencyKey("   "), false);
      assert.strictEqual(isValidIdempotencyKey(12345), false);
      assert.strictEqual(isValidIdempotencyKey("valid_key_001"), true);
    });
  });
});
