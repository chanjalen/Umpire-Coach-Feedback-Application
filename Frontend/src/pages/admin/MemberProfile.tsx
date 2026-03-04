import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface RatingRow {
  id: string;
  game: { id: string; title: string; scheduledAt: string };
  rater: { id: string; firstName: string; lastName: string };
  noShow: boolean;
  scores: Record<string, number | null>;
  overall: number | null;
  comments: string | null;
  submittedAt: string;
}

interface AvgData {
  count: number;
  overall: number | null;
  [key: string]: number | null | number;
}

interface MemberProfile {
  member: MemberInfo;
  ratings: RatingRow[];
  avg: AvgData | null;
  comments: string[];
}

// ─── Time filter options ──────────────────────────────────────────────────────

const TIME_FILTERS: { label: string; days: number | null }[] = [
  { label: 'All time',    days: null },
  { label: 'Last 7 days', days: 7    },
  { label: 'Last 14 days',days: 14   },
  { label: 'Last 30 days',days: 30   },
  { label: 'Last 90 days',days: 90   },
];

// ─── Category configs ─────────────────────────────────────────────────────────

const UMPIRE_CATS = [
  { key: 'overall',     label: 'Overall'      },
  { key: 'appearance',  label: 'Appearance'   },
  { key: 'judgment',    label: 'Judgment'     },
  { key: 'mechanics',   label: 'Mechanics'    },
  { key: 'gameControl', label: 'Game Control' },
  { key: 'composure',   label: 'Composure'    },
  { key: 'attitude',    label: 'Attitude'     },
];

const MANAGER_CATS = [
  { key: 'overall',       label: 'Overall'       },
  { key: 'sportsmanship', label: 'Sportsmanship' },
  { key: 'cooperation',   label: 'Cooperation'   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(v: number | null) {
  if (v === null) return 'text-muted-foreground';
  if (v >= 4) return 'text-green-400';
  if (v >= 3) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminMemberProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { orgId }  = useAuth();
  const navigate   = useNavigate();

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [selected, setSelected] = useState('overall');
  const [sortBy, setSortBy]     = useState('overall');
  const [sortDir, setSortDir]   = useState<'desc' | 'asc'>('desc');
  const [timeDays, setTimeDays] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId || !userId) return;
    api.get<MemberProfile>(`/orgs/${orgId}/members/${userId}/profile`)
      .then(res => setProfile(res.data))
      .catch(() => setError('Failed to load member profile.'))
      .finally(() => setLoading(false));
  }, [orgId, userId]);

  const cats       = profile?.member.role === 'UMPIRE' ? UMPIRE_CATS : MANAGER_CATS;
  const nonOverall = cats.filter(c => c.key !== 'overall');

  // ── Time-filtered ratings ──────────────────────────────────────────────────
  const filteredRatings = useMemo(() => {
    if (!profile) return [];
    if (timeDays === null) return profile.ratings;
    const cutoff = new Date(Date.now() - timeDays * 24 * 60 * 60 * 1000);
    return profile.ratings.filter(r => new Date(r.submittedAt) >= cutoff);
  }, [profile, timeDays]);

  // Recompute averages from the filtered set
  const filteredAvg = useMemo((): AvgData | null => {
    const countable = filteredRatings.filter(r => !r.noShow);
    if (countable.length === 0) return null;
    const scoreKeys = countable[0] ? Object.keys(countable[0].scores) : [];
    const mean = (vals: (number | null)[]) => {
      const nums = vals.filter((v): v is number => v !== null);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };
    const result: AvgData = {
      count:   countable.length,
      overall: mean(countable.map(r => r.overall)),
    };
    for (const key of scoreKeys) {
      result[key] = mean(countable.map(r => r.scores[key] ?? null));
    }
    return result;
  }, [filteredRatings]);

  // Recompute comments from the filtered set
  const filteredComments = useMemo(
    () => filteredRatings.filter(r => r.comments).map(r => r.comments as string),
    [filteredRatings],
  );

  const selectedValue = filteredAvg?.[selected] as number | null ?? null;
  const selectedLabel = cats.find(c => c.key === selected)?.label ?? 'Overall';

  const sortedRatings = useMemo(() => {
    return [...filteredRatings].sort((a, b) => {
      const aVal = sortBy === 'overall' ? (a.overall ?? -1) : (a.scores[sortBy] ?? -1);
      const bVal = sortBy === 'overall' ? (b.overall ?? -1) : (b.scores[sortBy] ?? -1);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [filteredRatings, sortBy, sortDir]);

  if (loading) return (
    <div className="space-y-4 max-w-3xl">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (error || !profile) return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <p className="text-destructive text-sm">{error || 'Member not found.'}</p>
    </div>
  );

  const { member } = profile;
  const avg      = filteredAvg;
  const comments = filteredComments;
  const isRatable = member.role === 'UMPIRE' || member.role === 'MANAGER' || member.role === 'COACH';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Member info */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{member.firstName} {member.lastName}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{member.email}</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-border bg-muted/30">
              {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
            </span>
            <p className="text-xs text-muted-foreground mt-1">Joined {formatDate(member.joinedAt)}</p>
          </div>
        </div>
      </div>

      {!isRatable && (
        <p className="text-muted-foreground text-sm">Admins do not receive ratings.</p>
      )}

      {isRatable && (
        <>
          {/* ── Ratings (same template as member dashboards) ── */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Ratings</h2>
                {avg && (
                  <span className="text-xs text-muted-foreground">{avg.count} rating{avg.count !== 1 ? 's' : ''}</span>
                )}
              </div>
              {/* Time filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {TIME_FILTERS.map(f => (
                  <button
                    key={f.label}
                    onClick={() => setTimeDays(f.days)}
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                      timeDays === f.days
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {!avg ? (
                <div className="text-center py-10">
                  <p className="text-muted-foreground text-sm">
                    {timeDays !== null ? `No ratings in the last ${timeDays} days.` : 'No ratings yet.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Category pills */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {cats.map(c => (
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
                  <div className={cn(
                    'grid gap-2 mt-4',
                    nonOverall.length <= 2 ? 'grid-cols-2 max-w-xs mx-auto' : 'grid-cols-3 sm:grid-cols-6',
                  )}>
                    {nonOverall.map(c => (
                      <button
                        key={c.key}
                        onClick={() => setSelected(c.key)}
                        className={cn(
                          'text-center p-2 rounded-md transition-colors',
                          selected === c.key ? 'bg-muted/40' : 'hover:bg-muted/20',
                        )}
                      >
                        <div className={cn('text-base font-semibold', scoreColor(avg[c.key] as number | null ?? null))}>
                          {(avg[c.key] as number | null) !== null ? (avg[c.key] as number).toFixed(1) : '—'}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{c.label}</div>
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Based on {avg.count} rating{avg.count !== 1 ? 's' : ''}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Feedback ── */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Feedback</h2>
                {comments.length > 0 && (
                  <span className="text-xs text-muted-foreground">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TIME_FILTERS.map(f => (
                  <button
                    key={f.label}
                    onClick={() => setTimeDays(f.days)}
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                      timeDays === f.days
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              {comments.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">
                  {timeDays !== null ? `No feedback in the last ${timeDays} days.` : 'No feedback yet.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((c, i) => (
                    <blockquote key={i} className="border-l-2 border-border pl-3 py-0.5">
                      <p className="text-sm">{c}</p>
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Individual ratings table ── */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-semibold">Individual Ratings ({sortedRatings.length})</h2>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                  title={sortDir === 'desc' ? 'High → Low' : 'Low → High'}
                >
                  {sortDir === 'desc'
                    ? <ArrowDown className="h-3.5 w-3.5" />
                    : <ArrowUp className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {sortedRatings.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center px-4 py-8">No ratings yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {sortedRatings.map(r => (
                  <div key={r.id} className="px-4 py-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <button
                          onClick={() => navigate(`/admin/games/${r.game.id}`)}
                          className="text-sm font-medium hover:underline underline-offset-2 text-left"
                        >
                          {r.game.title}
                        </button>
                        <p className="text-xs text-muted-foreground">{formatDateTime(r.game.scheduledAt)}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Rated by {r.rater.firstName} {r.rater.lastName}</p>
                        <p>{formatDate(r.submittedAt)}</p>
                      </div>
                    </div>

                    {r.noShow ? (
                      <p className="text-sm text-amber-400 italic">Marked as no-show</p>
                    ) : (
                      <>
                        {/* Score chips */}
                        <div className="flex flex-wrap gap-2">
                          {/* Overall */}
                          <div className="flex flex-col items-center bg-muted/40 rounded px-3 py-1.5 min-w-[56px]">
                            <span className={cn('text-sm font-bold tabular-nums', scoreColor(r.overall))}>
                              {r.overall !== null ? r.overall.toFixed(1) : '—'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Overall</span>
                          </div>
                          {/* Per-category */}
                          {Object.entries(r.scores).map(([key, val]) => {
                            const label = cats.find(c => c.key === key)?.label ?? key;
                            return (
                              <div key={key} className="flex flex-col items-center bg-muted/20 rounded px-3 py-1.5 min-w-[56px]">
                                <span className={cn('text-sm font-bold tabular-nums', scoreColor(val))}>
                                  {val !== null ? val : '—'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{label}</span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Comment */}
                        {r.comments && (
                          <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
                            {r.comments}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
