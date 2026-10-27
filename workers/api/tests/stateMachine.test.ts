import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  StateTransitionError,
  computeTermsSnapshotHash,
  validateStateTransition,
  type TransitionContext,
} from '../src/domain/stateMachine.ts';

const base: TransitionContext = {
  applicationId: 'app_1',
  applicationAgencyId: 'agency_default',
  actorUserId: 'user_officer',
  actorAgencyId: 'agency_default',
  actorRole: 'loan_officer',
  currentStatus: 'SUBMITTED',
  targetStatus: 'UNDER_REVIEW',
  borrowerId: 'user_borrower',
  assignedLenderId: 'user_lender',
  hasValidConsentSnapshot: false,
};

const ctx = (overrides: Partial<TransitionContext>): TransitionContext => ({ ...base, ...overrides });

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof StateTransitionError, 'expected StateTransitionError');
    assert.equal(error.code, code);
    return;
  }
  assert.fail(`expected StateTransitionError with code ${code}`);
}

describe('state machine — happy path', () => {
  const steps: Array<[TransitionContext['currentStatus'], TransitionContext['targetStatus'], TransitionContext['actorRole']]> = [
    ['DRAFT', 'SUBMITTED', 'borrower'],
    ['SUBMITTED', 'UNDER_REVIEW', 'loan_officer'],
    ['UNDER_REVIEW', 'MATCHING', 'underwriter'],
    ['MATCHING', 'LENDER_PENDING', 'agency_admin'],
    ['LENDER_PENDING', 'LENDER_ACCEPTED', 'lender'],
    ['LENDER_ACCEPTED', 'AGENCY_APPROVED', 'agency_admin'],
    ['AGENCY_APPROVED', 'BORROWER_ACCEPTED', 'borrower'],
    ['BORROWER_ACCEPTED', 'PENDING_DISBURSEMENT', 'cashier'],
    ['PENDING_DISBURSEMENT', 'ACTIVE', 'cashier'],
    ['ACTIVE', 'PAID_OFF', 'cashier'],
    ['PAID_OFF', 'CLOSED', 'agency_admin'],
  ];

  for (const [currentStatus, targetStatus, actorRole] of steps) {
    it(`allows ${currentStatus} -> ${targetStatus} as ${actorRole}`, () => {
      const actorUserId =
        actorRole === 'borrower' ? 'user_borrower' : actorRole === 'lender' ? 'user_lender' : 'user_officer';
      const needsConsent =
        targetStatus === 'BORROWER_ACCEPTED' ||
        targetStatus === 'PENDING_DISBURSEMENT' ||
        targetStatus === 'ACTIVE';

      assert.deepEqual(
        validateStateTransition(
          ctx({ currentStatus, targetStatus, actorRole, actorUserId, hasValidConsentSnapshot: needsConsent }),
        ),
        { valid: true },
      );
    });
  }
});

describe('state machine — non-bypass guards', () => {
  it('blocks lender acceptance jumping straight to borrower acceptance', () => {
    expectCode(
      () =>
        validateStateTransition(
          ctx({
            actorRole: 'lender',
            actorUserId: 'user_lender',
            currentStatus: 'LENDER_ACCEPTED',
            targetStatus: 'BORROWER_ACCEPTED',
            hasValidConsentSnapshot: true,
          }),
        ),
      'ILLEGAL_TRANSITION',
    );
  });

  it('blocks lender acceptance jumping straight to disbursement', () => {
    expectCode(
      () =>
        validateStateTransition(
          ctx({
            currentStatus: 'LENDER_ACCEPTED',
            targetStatus: 'PENDING_DISBURSEMENT',
            actorRole: 'agency_admin',
            hasValidConsentSnapshot: true,
          }),
        ),
      'ILLEGAL_TRANSITION',
    );
  });

  it('blocks disbursement without a consent snapshot', () => {
    expectCode(
      () =>
        validateStateTransition(
          ctx({
            currentStatus: 'BORROWER_ACCEPTED',
            targetStatus: 'PENDING_DISBURSEMENT',
            actorRole: 'cashier',
            hasValidConsentSnapshot: false,
          }),
        ),
      'CONSENT_REQUIRED',
    );
  });

  it('blocks agency staff from consenting on the borrower behalf', () => {
    expectCode(
      () =>
        validateStateTransition(
          ctx({
            currentStatus: 'AGENCY_APPROVED',
            targetStatus: 'BORROWER_ACCEPTED',
            actorRole: 'agency_admin',
            hasValidConsentSnapshot: true,
          }),
        ),
      'UNAUTHORIZED_ROLE',
    );
  });
});

describe('state machine — identity and tenancy', () => {
  it('rejects an unassigned lender', () => {
    expectCode(
      () =>
        validateStateTransition(
          ctx({
            currentStatus: 'LENDER_PENDING',
            targetStatus: 'LENDER_ACCEPTED',
            actorRole: 'lender',
            actorUserId: 'user_other_lender',
          }),
        ),
      'LENDER_NOT_ASSIGNED',
    );
  });

  it('rejects a borrower who does not own the application', () => {
    expectCode(
      () =>
        validateStateTransition(
          ctx({
            currentStatus: 'DRAFT',
            targetStatus: 'SUBMITTED',
            actorRole: 'borrower',
            actorUserId: 'user_other_borrower',
          }),
        ),
      'BORROWER_MISMATCH',
    );
  });

  it('rejects a cross-agency actor before any other check', () => {
    expectCode(
      () =>
        validateStateTransition(
          ctx({ actorAgencyId: 'agency_other', currentStatus: 'DRAFT', targetStatus: 'SUBMITTED' }),
        ),
      'TENANT_ISOLATION_VIOLATION',
    );
  });

  it('rejects unknown roles for agency-only transitions', () => {
    expectCode(
      () =>
        validateStateTransition(
          ctx({ currentStatus: 'SUBMITTED', targetStatus: 'UNDER_REVIEW', actorRole: 'borrower' }),
        ),
      'UNAUTHORIZED_ROLE',
    );
  });
});

describe('consent snapshot hashing', () => {
  const terms = {
    applicationId: 'app_1',
    proposalId: 'prop_1',
    borrowerId: 'user_borrower',
    termsVersion: 1,
    principalPesewas: 5_000_000,
    borrowerRateBps: 2100,
    tenureMonths: 36,
    consentedAt: 1_763_000_000_000,
  };

  it('is deterministic', async () => {
    assert.equal(await computeTermsSnapshotHash(terms), await computeTermsSnapshotHash({ ...terms }));
  });

  it('changes when any term changes', async () => {
    const original = await computeTermsSnapshotHash(terms);
    const tampered = await computeTermsSnapshotHash({ ...terms, principalPesewas: 5_000_001 });
    assert.notEqual(original, tampered);
  });

  it('produces a 64-character hex digest', async () => {
    assert.match(await computeTermsSnapshotHash(terms), /^[0-9a-f]{64}$/);
  });
});
