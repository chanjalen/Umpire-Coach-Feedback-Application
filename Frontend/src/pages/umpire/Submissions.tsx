import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { Game } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface SubData { id: string; status: string; myRatingsSubmitted: boolean }

interface SubResponse { id: string; status: string; myRatingsSubmitted: boolean }

interface GameWithSub extends Game {
  submissionId?: string;
  submissionStatus?: 'PENDING' | 'SUBMITTED';
  myRatingsSubmitted?: boolean;
}

interface MyIncident {
  id: string;
  title: string;
  description: string;
  resolvedAt: string | null;
  createdAt: string;
  game: { id: string; title: string } | null;
}

export default function UmpireSubmissions() {
  const { orgId } = useAuth();
  const navigate  = useNavigate();
  const [items, setItems]         = useState<GameWithSub[]>([]);
  const [myIncidents, setMyIncidents] = useState<MyIncident[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!orgId) return;

    api.get<MyIncident[]>(`/orgs/${orgId}/incidents/mine`)
      .then(res => setMyIncidents(res.data))
      .catch(() => {});

    api.get<Game[]>(`/orgs/${orgId}/games`)
      .then(async res => {
        const completed = res.data.filter(g => g.status === 'COMPLETED');
        const withSubs = await Promise.all(
          completed.map(async g => {
            try {
              const sub = await api.get<SubResponse[]>(`/orgs/${orgId}/games/${g.id}/submissions`);
              const s = sub.data[0];
              return { ...g, submissionId: s?.id, submissionStatus: s?.status as GameWithSub['submissionStatus'], myRatingsSubmitted: s?.myRatingsSubmitted };
            } catch {
              return g as GameWithSub;
            }
          }),
        );
        setItems(withSubs.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  function handleGo(item: GameWithSub) {
    if (item.submissionId) navigate(`/umpire/submissions/${item.submissionId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Submissions</h1>
        <p className="text-muted-foreground text-sm mt-1">Rate managers from your completed games</p>
      </div>

      {/* ── My Incidents ──────────────────────────────────────────────────────── */}
      {myIncidents.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <h2 className="font-semibold">My Reported Incidents</h2>
            <span className="ml-auto text-xs text-muted-foreground">{myIncidents.length} filed</span>
          </div>
          <div className="divide-y divide-border">
            {myIncidents.map(inc => (
              <div key={inc.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{inc.title}</p>
                  {inc.game && <p className="text-xs text-muted-foreground">{inc.game.title}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(inc.createdAt)}</p>
                </div>
                {inc.resolvedAt ? (
                  <span className="flex items-center gap-1 text-green-400 text-xs shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400 text-xs shrink-0">
                    <Clock className="h-3.5 w-3.5" /> Open
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No completed games with open submissions.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Game</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(g => (
                <tr key={g.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{g.title}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {formatDateTime(g.scheduledAt)}
                  </td>
                  <td className="px-4 py-3">
                    {!g.submissionId ? (
                      <span className="text-xs text-muted-foreground">No submission</span>
                    ) : (g.submissionStatus === 'SUBMITTED' || g.myRatingsSubmitted) ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 text-xs">
                        <Clock className="h-3.5 w-3.5" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {g.submissionId && (
                      <Button
                        size="sm"
                        variant={(g.submissionStatus === 'SUBMITTED' || g.myRatingsSubmitted) ? 'ghost' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => handleGo(g)}
                      >
                        {(g.submissionStatus === 'SUBMITTED' || g.myRatingsSubmitted) ? 'View' : 'Submit'}
                      </Button>
                    )}
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
