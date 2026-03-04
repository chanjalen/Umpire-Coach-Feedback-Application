import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, ChevronRight } from 'lucide-react';
import type { Game } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MyRatings {
  ratingsCount: number;
  meetsThreshold: boolean;
  threshold: number;
  avg: Record<string, number | null> | null;
  comments: string[];
}

interface PendingItem {
  submissionId: string;
  gameTitle: string;
  scheduledAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'overall',     label: 'Overall' },
  { key: 'appearance',  label: 'Appearance' },
  { key: 'judgment',    label: 'Judgment' },
  { key: 'mechanics',   label: 'Mechanics' },
  { key: 'gameControl', label: 'Game Control' },
  { key: 'composure',   label: 'Composure' },
  { key: 'attitude',    label: 'Attitude' },
];

const NON_OVERALL = CATEGORIES.filter(c => c.key !== 'overall');

function scoreColor(v: number | null) {
  if (v === null) return 'text-muted-foreground';
  if (v >= 4) return 'text-green-400';
  if (v >= 3) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function UmpireDashboard() {
  const { orgId } = useAuth();
  const navigate  = useNavigate();

  const [data, setData]         = useState<MyRatings | null>(null);
  const [pending, setPending]   = useState<PendingItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState('overall');

  useEffect(() => {
    if (!orgId) return;

    // Ratings data
    api.get<MyRatings>(`/orgs/${orgId}/me/ratings`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Pending submissions: load games → completed → submissions with status PENDING
    api.get<Game[]>(`/orgs/${orgId}/games`).then(async res => {
      const completed = res.data.filter(g => g.status === 'COMPLETED');
      const items: PendingItem[] = [];
      for (const g of completed) {
        try {
          const r = await api.get<Array<{ id: string; status: string; myRatingsSubmitted: boolean }>>(`/orgs/${orgId}/games/${g.id}/submissions`);
          const s = r.data[0];
          if (s && s.status === 'PENDING' && !s.myRatingsSubmitted) {
            items.push({ submissionId: s.id, gameTitle: g.title, scheduledAt: g.scheduledAt });
          }
        } catch { /* skip */ }
      }
      setPending(items);
    }).catch(() => {});
  }, [orgId]);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (!data) return null;

  const selectedValue = data.avg?.[selected] ?? null;
  const selectedLabel = CATEGORIES.find(c => c.key === selected)?.label ?? 'Overall';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your performance ratings and feedback</p>
      </div>

      {/* ── Pending Ratings ─────────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
            <h2 className="font-semibold">Pending Ratings</h2>
            <span className="ml-auto text-xs text-muted-foreground">{pending.length} open</span>
          </div>
          <div className="divide-y divide-border">
            {pending.map(item => (
              <button
                key={item.submissionId}
                onClick={() => navigate(`/umpire/submissions/${item.submissionId}`)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">{item.gameTitle}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.scheduledAt)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── My Ratings ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <h2 className="font-semibold">My Ratings</h2>
        </div>
        <div className="p-4">
          {!data.meetsThreshold ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-sm">Your ratings are not visible yet.</p>
              <p className="text-muted-foreground text-xs mt-1">
                You need {data.threshold - data.ratingsCount} more rating(s) before your scores are shown.
              </p>
            </div>
          ) : (
            <>
              {/* Category pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {CATEGORIES.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setSelected(c.key)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      selected === c.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Big score */}
              <div className="text-center py-4">
                <div className={cn('text-7xl font-bold tabular-nums leading-none', scoreColor(selectedValue))}>
                  {selectedValue !== null ? selectedValue.toFixed(1) : '—'}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{selectedLabel}</p>
              </div>

              {/* Mini grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
                {NON_OVERALL.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setSelected(c.key)}
                    className={cn(
                      'text-center p-2 rounded-md transition-colors',
                      selected === c.key ? 'bg-muted/40' : 'hover:bg-muted/20',
                    )}
                  >
                    <div className={cn('text-base font-semibold', scoreColor(data.avg?.[c.key] ?? null))}>
                      {data.avg?.[c.key]?.toFixed(1) ?? '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{c.label}</div>
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Based on {data.ratingsCount} rating(s)
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Feedback ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Feedback</h2>
          {data.comments.length > 0 && (
            <span className="text-xs text-muted-foreground">{data.comments.length} comment(s)</span>
          )}
        </div>
        <div className="p-4">
          {data.comments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No feedback yet.</p>
          ) : (
            <div className="space-y-3">
              {data.comments.map((comment, i) => (
                <blockquote key={i} className="border-l-2 border-border pl-3 py-0.5">
                  <p className="text-sm">{comment}</p>
                </blockquote>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
