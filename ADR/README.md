# Architecture Decision Records — owner decision gates

One record per owner gate from [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md).
Each records a Gidfine business decision from *open* to *accepted*, with the
version, date and rationale that [Definition of Done item 1](../IMPLEMENTATION_PLAN.md)
and [guide §16 change control](../Gidfine_Dev_Guide.md) require.

The gates do not block code: Sprints 1-7 are implemented, but every financial
and third-party path runs in **simulation mode** until the matching record is
accepted. Read the relevant ADR before changing behaviour that depends on it.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| **Open** | No decision recorded. Simulation defaults are in force; do not build live behaviour on them. |
| **Provisional** | A direction is recorded but a required detail is still missing. Code may follow the direction; it must not go live. |
| **Accepted** | Signed decision with version, date and rationale. Live behaviour may be implemented. |
| **Superseded** | Replaced by a later record; keep for history. |

## Index

| ADR | Gate | Decision area | Status | Blocks |
| --- | --- | --- | --- | --- |
| [0001](./0001-tenancy-model.md) | O-01 | Tenancy model | Open | Onboarding a second agency |
| [0002](./0002-legal-operating-model.md) | O-02 | Legal operating model | Provisional | Contracts, funded disbursement, payee, allocation |
| [0003](./0003-interest-calculation-method.md) | O-03 | Interest calculation method | Provisional | Live pricing engine, schedule generation |
| [0004](./0004-agency-margin-and-revenue.md) | O-04 | Agency margin & revenue rules | Provisional | Live quote maths, ledger revenue accounts |
| [0005](./0005-loan-product-parameters.md) | O-05 | Loan product parameters | Open | Product catalogue, schedule generator |
| [0006](./0006-lender-kyc-disclosures.md) | O-06 | Lender KYC disclosures | Open | Legally valid lender-facing payloads |
| [0007](./0007-document-retention-policy.md) | O-07 | Document retention policy | Open | R2 binding, document upload/download |
| [0008](./0008-lender-matching-workflow.md) | O-08 | Lender matching workflow | Provisional | Proposal routing model |
| [0009](./0009-maker-checker-and-approvals.md) | O-09 | Maker-checker & approvals | Open | Live disbursement authority, MFA hardening |
| [0010](./0010-payment-collection-scope.md) | O-10 | Payment collection scope | Provisional | Payment webhooks, reconciliation |
| [0011](./0011-notification-channels-and-budget.md) | O-11 | Notification channels & budget | Provisional | Real email/SMS delivery |
| [0012](./0012-generated-financial-documents.md) | O-12 | Generated financial documents | Open | PDF generation, digital signing |
| [0013](./0013-data-protection-act-843.md) | O-13 | Data protection (Act 843) | Open | Live borrower PII processing |
| [0014](./0014-lending-regulatory-licensing.md) | O-14 | Lending & credit licensing | Open | Commercial launch, live disbursement |

## Closing a record

1. Obtain the written decision from the owner named in the record.
2. Fill in *Decision*, *Rationale*, *Decided by* and *Accepted* date.
3. Update the status here and in [`IMPLEMENTATION_PLAN.md` §3](../IMPLEMENTATION_PLAN.md).
4. Only then remove the simulation flags listed under *Evidence in the codebase*.
5. Never rewrite an accepted decision — supersede it with a new record.
