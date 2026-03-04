import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CalendarDays, ShieldAlert, UserCheck } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonStat {
  userId: string;
  firstName: string;
  lastName: string;
  ratingsCount: number;
  avg: Record<string, number | null>;
}

interface IncidentStat {
  id: string;
  title: string;
  resolvedAt: string | null;
  createdAt: string;
  reporter: { id: string; firstName: string; lastName: string };
  subject:  { id: string; firstName: string; lastName: string };
  game:     { id: string; title: string } | null;
}

interface GameStat {
  id: string;
  title: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

interface OrgStats {
  umpires:     PersonStat[];
  managers:    PersonStat[];
  recentGames: GameStat[];
  incidents:   IncidentStat[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UMPIRE_CATEGORIES = [
  { key: 'overall',     label: 'Overall' },
  { key: 'appearance',  label: 'Appearance' },
  { key: 'judgment',    label: 'Judgment' },
  { key: 'mechanics',   label: 'Mechanics' },
  { key: 'gameControl', label: 'Game Control' },
  { key: 'composure',   label: 'Composure' },
  { key: 'attitude',    label: 'Attitude' },
];

const MANAGER_CATEGORIES = [
  { key: 'overall',       label: 'Overall' },
  { key: 'sportsmanship', label: 'Sportsmanship' },
  { key: 'cooperation',   label: 'Cooperation' },
];

const GAME_STATUS_CONFIG = {
  SCHEDULED:   { label: 'Scheduled',   className: 'text-blue-400' },
  IN_PROGRESS: { label: 'In Progress', className: 'text-amber-400' },
  COMPLETED:   { label: 'Completed',   className: 'text-green-400' },
  CANCELLED:   { label: 'Cancelled',   className: 'text-muted-foreground' },
};

type SortDir = 'desc' | 'asc' | 'name_asc' | 'name_desc' | 'most_rated';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  alert?: boolean;
}) {
  const hasAlert = alert && value > 0;
  return (
    <div className={cn(
      'rounded-xl border p-5 flex flex-col gap-3 transition-colors',
      hasAlert
        ? 'border-destructive/50 bg-destructive/8'
        : 'border-border bg-card',
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div className={cn(
          'p-1.5 rounded-md',
          hasAlert ? 'bg-destructive/15 text-destructive' : 'bg-muted/50 text-muted-foreground',
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={cn(
        'text-4xl font-bold tabular-nums leading-none',
        hasAlert ? 'text-destructive' : 'text-foreground',
      )}>
        {value}
      </div>
      {hasAlert && (
        <p className="text-xs text-destructive/80 font-medium">
          {value === 1 ? 'Requires attention' : 'Require attention'}
        </p>
      )}
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.min(100, (value / 5) * 100);
  const color =
    value >= 4 ? 'bg-green-500' :
    value >= 3 ? 'bg-amber-500' :
    'bg-red-500';
  const textColor =
    value >= 4 ? 'text-green-400' :
    value >= 3 ? 'text-amber-400' :
    'text-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums w-6 text-right', textColor)}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({
  title,
  people,
  categories,
}: {
  title: string;
  people: PersonStat[];
  categories: { key: string; label: string }[];
}) {
  const navigate = useNavigate();
  const [category, setCategory] = useState('overall');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    return [...people].sort((a, b) => {
      if (sortDir === 'name_asc')   return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sortDir === 'name_desc')  return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
      if (sortDir === 'most_rated') return b.ratingsCount - a.ratingsCount;
      const aVal = a.avg[category] ?? -1;
      const bVal = b.avg[category] ?? -1;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [people, category, sortDir]);

  const catLabel = categories.find(c => c.key === category)?.label ?? 'Score';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortDir} onValueChange={v => setSortDir(v as SortDir)}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">High → Low</SelectItem>
              <SelectItem value="asc">Low → High</SelectItem>
              <SelectItem value="name_asc">Name A → Z</SelectItem>
              <SelectItem value="name_desc">Name Z → A</SelectItem>
              <SelectItem value="most_rated">Most Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center px-4 py-8">No members yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium w-10">#</th>
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">{catLabel}</th>
              <th className="text-left px-4 py-2.5 font-medium">Ratings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((p, i) => (
              <tr
                key={p.userId}
                className="hover:bg-muted/10 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/members/${p.userId}`)}
              >
                <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{p.firstName} {p.lastName}</td>
                <td className="px-4 py-3">
                  <ScoreBar value={p.avg[category] ?? null} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.ratingsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { orgId } = useAuth();
  const navigate  = useNavigate();

  const [stats, setStats]     = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    api.get<OrgStats>(`/orgs/${orgId}/stats`)
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );

  if (!stats) return null;

  const openIncidents = stats.incidents.filter(i => !i.resolvedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Organization overview</p>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Umpires"        value={stats.umpires.length}    icon={UserCheck}   />
        <StatCard label="Managers"       value={stats.managers.length}   icon={Users}       />
        <StatCard label="Recent Games"   value={stats.recentGames.length} icon={CalendarDays} />
        <StatCard label="Open Incidents" value={openIncidents.length}    icon={ShieldAlert} alert />
      </div>

      {/* ── Open incidents ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-destructive/30 overflow-hidden">
        <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h2 className="font-semibold text-destructive">Open Incidents</h2>
          </div>
          <span className="text-xs font-medium text-destructive/70 bg-destructive/15 px-2 py-0.5 rounded-full">
            {openIncidents.length} open
          </span>
        </div>

        {openIncidents.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center px-4 py-8">No open incidents.</p>
        ) : (
          <div className="divide-y divide-destructive/10">
            {openIncidents.map(inc => (
              <div
                key={inc.id}
                onClick={() => navigate('/admin/incidents')}
                className="flex items-start gap-0 cursor-pointer group"
              >
                {/* Left accent stripe */}
                <div className="w-1 self-stretch bg-destructive/60 shrink-0 group-hover:bg-destructive transition-colors" />
                <div className="flex-1 px-4 py-4 bg-destructive/5 group-hover:bg-destructive/10 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{inc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground/70">
                          {inc.subject.firstName} {inc.subject.lastName}
                        </span>
                        {inc.game && (
                          <span className="text-muted-foreground"> · {inc.game.title}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDate(inc.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Leaderboards ──────────────────────────────────────────────────────── */}
      <Leaderboard title="Umpire Ratings"  people={stats.umpires}  categories={UMPIRE_CATEGORIES}  />
      <Leaderboard title="Manager Ratings" people={stats.managers} categories={MANAGER_CATEGORIES} />

      {/* ── Recent Games ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <h2 className="font-semibold">Recent Games</h2>
        </div>

        {stats.recentGames.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center px-4 py-8">No games yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {stats.recentGames.map(g => {
              const sc = GAME_STATUS_CONFIG[g.status];
              return (
                <div
                  key={g.id}
                  onClick={() => navigate(`/admin/games/${g.id}`)}
                  className="px-4 py-3 flex items-center justify-between hover:bg-muted/10 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-sm">{g.title}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground hidden sm:block whitespace-nowrap">
                      {formatDateTime(g.scheduledAt)}
                    </span>
                    <span className={sc.className}>{sc.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
