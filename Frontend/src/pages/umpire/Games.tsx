import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { Game, GameStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

const STATUS_CLASSES: Record<GameStatus, string> = {
  SCHEDULED:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  IN_PROGRESS: 'bg-green-500/15 text-green-400 border-green-500/20',
  COMPLETED:   'bg-muted/60 text-muted-foreground border-border',
  CANCELLED:   'bg-destructive/15 text-destructive border-destructive/20',
};

interface SubInfo { id: string; status: string; myRatingsSubmitted: boolean }

export default function UmpireGames() {
  const { orgId } = useAuth();
  const navigate  = useNavigate();
  const [games, setGames]               = useState<Game[]>([]);
  const [subMap, setSubMap]             = useState<Record<string, SubInfo>>({});
  const [myIncidentGameIds, setMyIncidentGameIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  useEffect(() => {
    if (!orgId) return;

    // Fetch incidents filed by this user to know which games they reported on
    api.get<Array<{ game: { id: string } | null }>>(`/orgs/${orgId}/incidents/mine`)
      .then(res => {
        const ids = new Set(res.data.map(i => i.game?.id).filter(Boolean) as string[]);
        setMyIncidentGameIds(ids);
      })
      .catch(() => {});

    api.get<Game[]>(`/orgs/${orgId}/games`)
      .then(async res => {
        setGames(res.data);
        // Fetch submissions for completed games in parallel
        const completed = res.data.filter(g => g.status === 'COMPLETED');
        const results = await Promise.all(
          completed.map(async g => {
            try {
              const r = await api.get<SubInfo[]>(`/orgs/${orgId}/games/${g.id}/submissions`);
              const s = r.data[0];
              return s ? { gameId: g.id, sub: s } : null;
            } catch { return null; }
          }),
        );
        const map: Record<string, SubInfo> = {};
        for (const r of results) { if (r) map[r.gameId] = r.sub; }
        setSubMap(map);
      })
      .catch(() => setError('Failed to load games.'))
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Games</h1>
        <p className="text-muted-foreground text-sm mt-1">Games you are assigned to</p>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2 w-fit">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span>Indicates an incident was reported during that game</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : games.length === 0 ? (
        <p className="text-muted-foreground text-sm">No games assigned yet.</p>
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
              {games.map(g => {
                const sub = subMap[g.id];
                return (
                  <tr key={g.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {myIncidentGameIds.has(g.id) && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" title="You reported an incident for this game" />}
                        <div>
                          <p className="font-medium leading-tight">{g.title}</p>
                          {(g.homeTeam || g.awayTeam) && (
                            <p className="text-xs text-muted-foreground">{g.homeTeam ?? '?'} vs {g.awayTeam ?? '?'}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {formatDateTime(g.scheduledAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                        STATUS_CLASSES[g.status],
                      )}>
                        {g.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {g.status === 'COMPLETED' && sub && (
                        <Button
                          size="sm"
                          variant={(sub.status === 'SUBMITTED' || sub.myRatingsSubmitted) ? 'ghost' : 'outline'}
                          className="h-7 text-xs"
                          onClick={() => navigate(`/umpire/submissions/${sub.id}`)}
                        >
                          {(sub.status === 'SUBMITTED' || sub.myRatingsSubmitted) ? 'View' : 'Rate'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
