import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { Game, GameStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, AlertTriangle, ChevronRight, X, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

const STATUS_CLASSES: Record<GameStatus, string> = {
  SCHEDULED:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  IN_PROGRESS: 'bg-green-500/15 text-green-400 border-green-500/20',
  COMPLETED:   'bg-muted/60 text-muted-foreground border-border',
  CANCELLED:   'bg-destructive/15 text-destructive border-destructive/20',
};

const ALL_STATUSES: Array<GameStatus | 'ALL'> = ['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

interface SlimMember {
  userId: string;
  firstName: string;
  lastName: string;
}

interface UmpireAssignment { userId: string; position: 'plate' | 'base' }
interface ManagerAssignment { userId: string; team: 'home' | 'away' }

// ─── Searchable member picker ─────────────────────────────────────────────────

function MemberPicker({
  members,
  selectedId,
  placeholder,
  onSelect,
}: {
  members: SlimMember[];
  selectedId: string;
  placeholder: string;
  onSelect: (member: SlimMember | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = members.find(m => m.userId === selectedId) ?? null;

  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase()),
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (selected) onSelect(null); // clear selection when typing
    setOpen(true);
  }

  function handleSelect(member: SlimMember) {
    onSelect(member);
    setQuery('');
    setOpen(false);
  }

  const displayValue = selected ? `${selected.firstName} ${selected.lastName}` : query;

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8 h-9 text-sm"
          placeholder={placeholder}
          value={displayValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        {selected && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { onSelect(null); setQuery(''); }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results.</p>
          ) : (
            <ul className="max-h-40 overflow-y-auto">
              {filtered.map(m => (
                <li key={m.userId}>
                  <button
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors',
                      selectedId === m.userId && 'bg-muted/40 font-medium',
                    )}
                    onMouseDown={e => { e.preventDefault(); handleSelect(m); }}
                  >
                    {m.firstName} {m.lastName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminGames() {
  const { orgId } = useAuth();
  const navigate  = useNavigate();

  const [games, setGames]             = useState<Game[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [statusFilter, setStatusFilter] = useState<GameStatus | 'ALL'>('ALL');

  // Create dialog
  const [createOpen, setCreateOpen]   = useState(false);
  const [form, setForm] = useState({
    title: '', homeTeam: '', awayTeam: '', location: '', fieldNumber: '',
    scheduledAt: '', level: '', notes: '',
  });
  const [umpireAssignments, setUmpireAssignments] = useState<UmpireAssignment[]>([]);
  const [managerAssignments, setManagerAssignments] = useState<ManagerAssignment[]>([]);

  // Org members for assignment dropdowns
  const [orgUmpires, setOrgUmpires]   = useState<SlimMember[]>([]);
  const [orgManagers, setOrgManagers] = useState<SlimMember[]>([]);

  // Pending add state
  const [pendingUmpire, setPendingUmpire] = useState<{ userId: string; position: 'plate' | 'base' }>({ userId: '', position: 'plate' });
  const [pendingManager, setPendingManager] = useState<{ userId: string; team: 'home' | 'away' }>({ userId: '', team: 'home' });

  const [createError, setCreateError] = useState('');
  const [creating, setCreating]       = useState(false);

  function load() {
    if (!orgId) return;
    setLoading(true);
    const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
    api.get<Game[]>(`/orgs/${orgId}/games${params}`)
      .then(res => setGames(res.data))
      .catch(() => setError('Failed to load games.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orgId, statusFilter]);

  // Fetch org members when dialog opens
  useEffect(() => {
    if (!createOpen || !orgId) return;
    api.get<Array<{ userId: string; role: string; user: { firstName: string; lastName: string } }>>(
      `/orgs/${orgId}/members`,
    ).then(res => {
      const toSlim = (m: { userId: string; user: { firstName: string; lastName: string } }): SlimMember => ({
        userId: m.userId,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      });
      setOrgUmpires(res.data.filter(m => m.role === 'UMPIRE').map(toSlim));
      setOrgManagers(res.data.filter(m => m.role === 'MANAGER' || m.role === 'COACH').map(toSlim));
    }).catch(() => {});
  }, [createOpen, orgId]);

  function updateForm(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addUmpire() {
    if (!pendingUmpire.userId) return;
    if (umpireAssignments.some(u => u.userId === pendingUmpire.userId)) return;
    setUmpireAssignments(prev => [...prev, { ...pendingUmpire }]);
    setPendingUmpire({ userId: '', position: 'plate' });
  }

  function addManager() {
    if (!pendingManager.userId) return;
    if (managerAssignments.some(m => m.userId === pendingManager.userId)) return;
    setManagerAssignments(prev => [...prev, { ...pendingManager }]);
    setPendingManager({ userId: '', team: 'home' });
  }

  function removeUmpire(userId: string) {
    setUmpireAssignments(prev => prev.filter(u => u.userId !== userId));
  }

  function removeManager(userId: string) {
    setManagerAssignments(prev => prev.filter(m => m.userId !== userId));
  }

  function resetDialog() {
    setForm({ title: '', homeTeam: '', awayTeam: '', location: '', fieldNumber: '', scheduledAt: '', level: '', notes: '' });
    setUmpireAssignments([]);
    setManagerAssignments([]);
    setPendingUmpire({ userId: '', position: 'plate' });
    setPendingManager({ userId: '', team: 'home' });
    setCreateError('');
  }

  async function handleCreate() {
    if (!orgId) return;
    setCreateError('');
    setCreating(true);
    try {
      const locationStr = [form.location, form.fieldNumber ? `Field ${form.fieldNumber}` : '']
        .filter(Boolean).join(' — ') || undefined;
      const payload = {
        title: form.title,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        ...(form.homeTeam && { homeTeam: form.homeTeam }),
        ...(form.awayTeam && { awayTeam: form.awayTeam }),
        ...(locationStr   && { location: locationStr }),
        ...(form.level    && { level:    form.level }),
        ...(form.notes    && { notes:    form.notes }),
        ...(umpireAssignments.length  && { umpires:  umpireAssignments }),
        ...(managerAssignments.length && { managers: managerAssignments }),
      };
      await api.post(`/orgs/${orgId}/games`, payload);
      setCreateOpen(false);
      resetDialog();
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setCreateError(msg ?? 'Failed to create game.');
    } finally {
      setCreating(false);
    }
  }

  const filtered = statusFilter === 'ALL' ? games : games.filter(g => g.status === statusFilter);

  // Members not yet assigned (for pickers)
  const availableUmpires  = orgUmpires.filter(m => !umpireAssignments.some(a => a.userId === m.userId));
  const availableManagers = orgManagers.filter(m => !managerAssignments.some(a => a.userId === m.userId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Games</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? '…' : `${games.length} total`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add game
        </Button>
      </div>

      {/* Incident legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2 w-fit">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span>Indicates an incident has been reported for this game</span>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              statusFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
            )}
          >
            {s === 'ALL' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">No games found.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Game</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Location</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(g => (
                <tr
                  key={g.id}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/games/${g.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {g.hasIncident && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" title="Incident reported for this game" />
                      )}
                      <div>
                        <p className="font-medium leading-tight">{g.title}</p>
                        {(g.homeTeam || g.awayTeam) && (
                          <p className="text-xs text-muted-foreground">
                            {g.homeTeam ?? '?'} vs {g.awayTeam ?? '?'}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {formatDateTime(g.scheduledAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {g.location ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                      STATUS_CLASSES[g.status],
                    )}>
                      {g.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add game</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* ── Basic info ── */}
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input placeholder="Game 1 — Metro League" value={form.title} onChange={e => updateForm('title', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Home team</Label>
                <Input placeholder="Tigers" value={form.homeTeam} onChange={e => updateForm('homeTeam', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Away team</Label>
                <Input placeholder="Eagles" value={form.awayTeam} onChange={e => updateForm('awayTeam', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Date & time <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={e => updateForm('scheduledAt', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="Riverside Park" value={form.location} onChange={e => updateForm('location', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Field #</Label>
                <Input placeholder="3" value={form.fieldNumber} onChange={e => updateForm('fieldNumber', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Level</Label>
              <Input placeholder="Varsity" value={form.level} onChange={e => updateForm('level', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Any additional notes…" value={form.notes} onChange={e => updateForm('notes', e.target.value)} rows={2} />
            </div>

            <Separator />

            {/* ── Umpires ── */}
            <div className="space-y-2">
              <Label>Umpires</Label>

              {umpireAssignments.length > 0 && (
                <div className="space-y-1.5">
                  {umpireAssignments.map(a => {
                    const member = orgUmpires.find(m => m.userId === a.userId);
                    return (
                      <div key={a.userId} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2 text-sm">
                        <span>{member?.firstName} {member?.lastName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize">{a.position}</span>
                          <button onClick={() => removeUmpire(a.userId)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {availableUmpires.length > 0 && (
                <div className="flex gap-2">
                  <MemberPicker
                    members={availableUmpires}
                    selectedId={pendingUmpire.userId}
                    placeholder="Search umpire…"
                    onSelect={m => setPendingUmpire(p => ({ ...p, userId: m?.userId ?? '' }))}
                  />
                  <Select value={pendingUmpire.position} onValueChange={v => setPendingUmpire(p => ({ ...p, position: v as 'plate' | 'base' }))}>
                    <SelectTrigger className="w-24 text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plate">Plate</SelectItem>
                      <SelectItem value="base">Base</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" onClick={addUmpire} disabled={!pendingUmpire.userId}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {availableUmpires.length === 0 && umpireAssignments.length === 0 && (
                <p className="text-xs text-muted-foreground">No umpires in this org yet.</p>
              )}
              {availableUmpires.length === 0 && umpireAssignments.length > 0 && (
                <p className="text-xs text-muted-foreground">All umpires assigned.</p>
              )}
            </div>

            <Separator />

            {/* ── Managers ── */}
            <div className="space-y-2">
              <Label>Managers</Label>

              {managerAssignments.length > 0 && (
                <div className="space-y-1.5">
                  {managerAssignments.map(a => {
                    const member = orgManagers.find(m => m.userId === a.userId);
                    return (
                      <div key={a.userId} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2 text-sm">
                        <span>{member?.firstName} {member?.lastName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize">{a.team} team</span>
                          <button onClick={() => removeManager(a.userId)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {availableManagers.length > 0 && (
                <div className="flex gap-2">
                  <MemberPicker
                    members={availableManagers}
                    selectedId={pendingManager.userId}
                    placeholder="Search manager…"
                    onSelect={m => setPendingManager(p => ({ ...p, userId: m?.userId ?? '' }))}
                  />
                  <Select value={pendingManager.team} onValueChange={v => setPendingManager(p => ({ ...p, team: v as 'home' | 'away' }))}>
                    <SelectTrigger className="w-24 text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="away">Away</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" onClick={addManager} disabled={!pendingManager.userId}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {availableManagers.length === 0 && managerAssignments.length === 0 && (
                <p className="text-xs text-muted-foreground">No managers in this org yet.</p>
              )}
              {availableManagers.length === 0 && managerAssignments.length > 0 && (
                <p className="text-xs text-muted-foreground">All managers assigned.</p>
              )}
            </div>

            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetDialog(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !form.title || !form.scheduledAt}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
