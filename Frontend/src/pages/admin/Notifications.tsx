import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { EmailNotification } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_CLASSES: Record<string, string> = {
  SENT:    'bg-green-500/15 text-green-400 border-green-500/20',
  PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  FAILED:  'bg-destructive/15 text-destructive border-destructive/20',
};

const TYPE_LABELS: Record<string, string> = {
  SUBMISSION_OPEN:             'Submission opened',
  SUBMISSION_REMINDER_3:       'Reminder (day 3)',
  SUBMISSION_REMINDER_7:       'Reminder (day 7)',
  SUBMISSION_REMINDER_MANUAL:  'Manual reminder',
  INCIDENT_FILED:              'Incident filed',
};

export default function AdminNotifications() {
  const { orgId } = useAuth();
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!orgId) return;
    api.get<EmailNotification[]>(`/orgs/${orgId}/notifications`)
      .then(res => setNotifications(res.data))
      .catch(() => setError('Failed to load notifications.'))
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">Email notification log for this organization.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : notifications.length === 0 ? (
        <p className="text-muted-foreground text-sm">No notifications yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Recipient</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Subject</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notifications.map(n => (
                <tr key={n.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    {n.user ? (
                      <div>
                        <p className="font-medium">{n.user.firstName} {n.user.lastName}</p>
                        <p className="text-xs text-muted-foreground">{n.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                    {n.type ? (TYPE_LABELS[n.type] ?? n.type) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground truncate max-w-xs">
                    {n.subject}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                      STATUS_CLASSES[n.status] ?? 'bg-muted text-muted-foreground border-border',
                    )}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {n.sentAt ? formatDateTime(n.sentAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
