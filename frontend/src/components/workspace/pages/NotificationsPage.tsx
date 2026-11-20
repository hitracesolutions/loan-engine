import { useEffect, useState } from 'react';
import { Bell, CheckCheck, CreditCard, FileText, Wallet } from 'lucide-react';
import { gidfineAPI, pesewasToGhsString } from '../../../lib/api-gidfine';

interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: Date;
  read: boolean;
  icon: 'loan' | 'application' | 'payment';
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GH', { day: '2-digit', month: 'short' });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
}

const iconMap = {
  loan: <Wallet className="h-4 w-4" strokeWidth={1.5} />,
  application: <FileText className="h-4 w-4" strokeWidth={1.5} />,
  payment: <CreditCard className="h-4 w-4" strokeWidth={1.5} />,
};

const iconBg = {
  loan: 'bg-[#f0f9f7] text-[#0d3d38]',
  application: 'bg-amber-50 text-amber-700',
  payment: 'bg-blue-50 text-blue-700',
};

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className ?? ''}`} />;
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-6 pb-10">
      {/* header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Shimmer className="h-6 w-36" />
          <Shimmer className="h-3.5 w-20" />
        </div>
      </div>
      {/* card */}
      <div className="dashboard-card rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--dash-border)' }}>
        {/* section label */}
        <div className="border-b px-5 py-3" style={{ borderColor: 'var(--dash-border)' }}>
          <Shimmer className="h-3 w-10" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex items-start gap-4 px-5 py-4 ${i < 4 ? 'border-b' : ''}`} style={{ borderColor: 'var(--dash-border)' }}>
            <Shimmer className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-3.5 w-40" />
              <Shimmer className="h-3 w-64" />
            </div>
            <Shimmer className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([gidfineAPI.listApplications(), gidfineAPI.listLoans()])
      .then(([apps, lns]) => {
        if (!mounted) return;
        const notifs: AppNotification[] = [];

        if (apps.status === 'fulfilled' && Array.isArray(apps.value)) {
          (apps.value as any[]).forEach((a) => {
            const ts = a.updated_at ?? a.created_at;
            notifs.push({
              id: `app-${a.id}`,
              title: 'Loan application updated',
              body: `Application #${String(a.id).slice(0, 8).toUpperCase()} is now ${a.status?.replace(/_/g, ' ').toLowerCase()}.`,
              time: new Date(Number(ts)),
              read: false,
              icon: 'application',
            });
          });
        }

        if (lns.status === 'fulfilled' && Array.isArray(lns.value)) {
          (lns.value as any[]).forEach((l) => {
            const ts = l.updated_at ?? l.created_at;
            const outstanding =
              (l.outstanding_principal_pesewas ?? 0) +
              (l.outstanding_interest_pesewas ?? 0) +
              (l.outstanding_fees_pesewas ?? 0);
            notifs.push({
              id: `loan-${l.id}`,
              title: 'Loan status changed',
              body: `Loan #${String(l.id).slice(0, 8).toUpperCase()} · ${l.status?.replace(/_/g, ' ').toLowerCase()} · Outstanding: ${pesewasToGhsString(outstanding)}`,
              time: new Date(Number(ts)),
              read: false,
              icon: 'loan',
            });
          });
        }

        notifs.sort((a, b) => b.time.getTime() - a.time.getTime());
        if (mounted) setNotifications(notifs);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markRead = (id: string) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

  const unread = notifications.filter((n) => !n.read).length;
  const todayItems = notifications.filter((n) => isToday(n.time));
  const earlierItems = notifications.filter((n) => !isToday(n.time));

  if (loading) return <NotificationsSkeleton />;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-xl font-semibold">Notifications</h1>
          {unread > 0 && (
            <p className="dashboard-subtle mt-0.5 text-sm">{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--dash-border)', color: '#0d3d38' }}
          >
            <CheckCheck className="h-4 w-4" strokeWidth={1.5} />
            Mark all as read
          </button>
        )}
      </div>

      {/* Content card */}
      <div className="dashboard-card rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--dash-border)' }}>
        {notifications.length === 0 ? (
          /* Empty state — ChainOA style */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-gray-100">
              <Bell className="h-6 w-6 text-gray-400" strokeWidth={1.5} />
            </span>
            <p className="text-sm font-medium text-gray-700">No notifications yet</p>
            <p className="mt-1 text-sm text-gray-400">Activity on your account will appear here.</p>
          </div>
        ) : (
          <div>
            {/* Today */}
            {todayItems.length > 0 && (
              <div>
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--dash-border)' }}>
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Today</span>
                </div>
                {todayItems.map((n, i) => (
                  <NotifRow key={n.id} n={n} last={i === todayItems.length - 1 && earlierItems.length === 0} onRead={markRead} />
                ))}
              </div>
            )}

            {/* Earlier */}
            {earlierItems.length > 0 && (
              <div>
                <div className="px-5 py-3 border-b border-t" style={{ borderColor: 'var(--dash-border)' }}>
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Earlier</span>
                </div>
                {earlierItems.map((n, i) => (
                  <NotifRow key={n.id} n={n} last={i === earlierItems.length - 1} onRead={markRead} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NotifRow({ n, last, onRead }: { n: AppNotification; last: boolean; onRead: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onRead(n.id)}
      className={`w-full flex items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 ${!last ? 'border-b' : ''} ${!n.read ? 'bg-[#f0f9f7]/40' : ''}`}
      style={{ borderColor: 'var(--dash-border)' }}
    >
      {/* Icon */}
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconBg[n.icon]}`}>
        {iconMap[n.icon]}
      </span>

      {/* Text */}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{n.title}</span>
          {!n.read && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0d3d38]" />
          )}
        </span>
        <span className="mt-0.5 block text-sm text-gray-500 leading-snug">{n.body}</span>
      </span>

      {/* Time */}
      <span className="shrink-0 text-xs text-gray-400 mt-0.5">{timeAgo(n.time)}</span>
    </button>
  );
}
