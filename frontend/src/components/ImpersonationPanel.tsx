/**
 * Administrator control for starting a "view as" session.
 *
 * Sessions are read-only by design: this panel can start one and the banner can
 * end it, and nothing else. Every start and stop is written to the server-side
 * security audit log.
 */

import { useEffect, useState } from 'react';
import { api, type AdminUserSummary } from '../lib/api-gidfine';

const ROLE_LABELS: Record<string, string> = {
  borrower: 'Borrower',
  lender: 'Lender',
  loan_officer: 'Loan officer',
  underwriter: 'Underwriter',
  cashier: 'Cashier',
  auditor: 'Auditor',
};

export function ImpersonationPanel() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listImpersonatableUsers();
      setUsers(response.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const viewAs = async (user: AdminUserSummary) => {
    const confirmed = window.confirm(
      `View the platform as ${user.email}?\n\nThe session is read-only and audited. It ends automatically after 15 minutes.`,
    );
    if (!confirmed) return;

    setPendingUserId(user.id);
    setError(null);
    try {
      await api.startImpersonation(user.id);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start impersonation');
      setPendingUserId(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">View as user</h2>
        <p className="mt-1 text-sm text-slate-600">
          Start a read-only, audited session as another account. Financial and legal actions are
          blocked while impersonating, and the session expires after 15 minutes.
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-500">No impersonatable accounts in this agency.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-900">{user.fullName || '—'}</td>
                  <td className="py-2 pr-4 text-slate-700">{user.email}</td>
                  <td className="py-2 pr-4 text-slate-700">{ROLE_LABELS[user.role] ?? user.role}</td>
                  <td className="py-2 pr-4 text-slate-500">
                    {user.isActive === 0 ? 'Disabled' : 'Active'}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => void viewAs(user)}
                      disabled={pendingUserId !== null || user.isActive === 0}
                      className="rounded border border-slate-300 px-3 py-1 font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {pendingUserId === user.id ? 'Starting…' : 'View as'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-sm font-medium text-slate-600 underline disabled:opacity-50"
        >
          Refresh list
        </button>
      </div>
    </section>
  );
}

export default ImpersonationPanel;
