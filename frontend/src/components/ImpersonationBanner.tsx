/**
 * Persistent banner shown while an administrator is viewing the platform as
 * another user. Impersonated sessions are read-only on the server, so the only
 * action offered here is ending the session.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, type ImpersonationState } from '../lib/api-gidfine';

export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(() => api.getImpersonationState());
  const [exiting, setExiting] = useState(false);

  const sync = useCallback(() => setState(api.getImpersonationState()), []);

  useEffect(() => {
    window.addEventListener('gidfine:impersonation-changed', sync);
    // Re-check on an interval so an expired session disappears on its own.
    const timer = window.setInterval(sync, 30_000);
    return () => {
      window.removeEventListener('gidfine:impersonation-changed', sync);
      window.clearInterval(timer);
    };
  }, [sync]);

  if (!state) return null;

  const minutesLeft = Math.max(0, Math.ceil((state.expiresAt * 1000 - Date.now()) / 60_000));

  const exit = async () => {
    setExiting(true);
    await api.stopImpersonation();
    window.location.reload();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true">👁️</span>
        <span className="font-semibold">Viewing as {state.targetUser.email}</span>
        <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
          {state.targetUser.role.replace(/_/g, ' ')}
        </span>
        <span className="text-amber-800">Read-only session · {minutesLeft} min left</span>
      </div>
      <button
        type="button"
        onClick={exit}
        disabled={exiting}
        className="rounded border border-amber-400 bg-white px-3 py-1 font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60"
      >
        {exiting ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  );
}

export default ImpersonationBanner;
