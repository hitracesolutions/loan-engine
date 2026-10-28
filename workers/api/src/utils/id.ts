/**
 * ID Generation — Unique IDs with prefixes
 */

/**
 * Generate a prefixed unique ID
 * Example: borrower_1234567890abcdef
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}${random}`;
}

// Specific ID generators
export const ids = {
  borrower: () => generateId("borrower"),
  lender: () => generateId("lender"),
  application: () => generateId("app"),
  loan: () => generateId("loan"),
  payment: () => generateId("payment"),
  proposal: () => generateId("proposal"),
  schedule: () => generateId("schedule"),
  document: () => generateId("doc"),
  user: () => generateId("user"),
  ledger: () => generateId("ledger"),
  notification: () => generateId("notif"),
};
