import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { Game, Submission, GameStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatDateTime, formatDate, cn } from '@/lib/utils';
import { ArrowLeft, AlertTriangle, Bell, Send, CheckCircle2, Clock, Pencil, Plus, X, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

const STATUS_CLASSES: Record<GameStatus, string> = {
  SCHEDULED:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  IN_PROGRESS: 'bg-green-500/15 text-green-400 border-green-500/20',
  COMPLETED:   'bg-muted/60 text-muted-foreground border-border',
  CANCELLED:   'bg-destructive/15 text-destructive border-destructive/20',
};

interface PersonRef { id: string; firstName: string; lastName: string; email?: string }

interface CoachRating {
  id: string;
  coach: PersonRef;
  umpireId: string;
  noShow: boolean;
  appearance: number | null;
  judgment: number | null;
  mechanics: number | null;
  gameControl: number | null;
  composure: number | null;
  attitude: number | null;
  comments: string | null;
  submittedAt: string;
}

interface UmpireRating {
  id: string;
  umpire: PersonRef;
  managerId: string;
  noShow: boolean;
  sportsmanship: number | null;
  cooperation: number | null;
  comments: string | null;
  submittedAt: string;
}

interface AdminSubmissionDetail {
  id: string;
  status: 'PENDING' | 'SUBMITTED';
  coachRatings: CoachRating[];
  umpireRatings: UmpireRating[];
  game: {
    umpires:  Array<{ userId: string; position: string; user?: PersonRef }>;
    managers: Array<{ userId: string; team: string;     user?: PersonRef }>;
  };
}

interface GameIncident {
  id: string;
  title: string;
  description: string;
  resolvedAt: string | null;
  createdAt: string;
  reporter: PersonRef;
  subject:  PersonRef;
}

interface SlimMember {
  userId: string;
  firstName: string;
  lastName: string;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const COACH_CATS = [
  { key: 'appearance',  label: 'Appearance'   },
  { key: 'judgment',    label: 'Judgment'     },
  { key: 'mechanics',   label: 'Mechanics'    },
  { key: 'gameControl', label: 'Game Control' },
  { key: 'composure',   label: 'Composure'    },
  { key: 'attitude',    label: 'Attitude'     },
];

const UMPIRE_CATS = [
  { key: 'sportsmanship', label: 'Sportsmanship' },
  { key: 'cooperation',   label: 'Cooperation'   },
];

function ScoreChip({ label, value }: { label: string; value: number | null }) {
  const color = value === null ? 'text-muted-foreground'
    : value >= 4 ? 'text-green-400'
    : value >= 3 ? 'text-amber-400'
    : 'text-red-400';
  return (
    <div className="flex items-center justify-between bg-muted/20 rounded px-2 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-bold', color)}>{value ?? '—'}{value !== null && <span className="text-muted-foreground font-normal"> /5</span>}</span>
    </div>
  );
}

// Convert ISO datetime to datetime-local input value (local time)
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

// Try to split "Location — Field X" back into parts
function parseLocation(loc: string | undefined | null) {
  if (!loc) return { location: '', fieldNumber: '' };
  const match = loc.match(/^(.+) — Field (.+)$/);
  if (match) return { location: match[1], fieldNumber: match[2] };
  return { location: loc, fieldNumber: '' };
}

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
    if (selected) onSelect(null);
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminGameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const { orgId }  = useAuth();
  const navigate   = useNavigate();

  const [game, setGame]                     = useState<Game | null>(null);
  const [submission, setSubmission]         = useState<Submission | null>(null);
  const [subDetail, setSubDetail]           = useState<AdminSubmissionDetail | null>(null);
  const [incidents, setIncidents]           = useState<GameIncident[]>([]);
  const [loading, setLoading]               = useState(true);
  const [reminding, setReminding]           = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError]                   = useState('');

  // ── Edit game info ──
  const [editOpen, setEditOpen]   = useState(false);
  const [editForm, setEditForm]   = useState({
    title: '', homeTeam: '', awayTeam: '', scheduledAt: '',
    location: '', fieldNumber: '', level: '', notes: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState('');

  // ── Add participants ──
  const [addOpen, setAddOpen]         = useState(false);
  const [orgUmpires, setOrgUmpires]   = useState<SlimMember[]>([]);
  const [orgManagers, setOrgManagers] = useState<SlimMember[]>([]);
  const [pendingUmpire, setPendingUmpire] = useState<{ userId: string; position: 'plate' | 'base' }>({ userId: '', position: 'plate' });
  const [pendingManager, setPendingManager] = useState<{ userId: string; team: 'home' | 'away' }>({ userId: '', team: 'home' });
  const [addSaving, setAddSaving]   = useState(false);
  const [addError, setAddError]     = useState('');
  const [umpiresToAdd, setUmpiresToAdd]     = useState<Array<{ userId: string; position: 'plate' | 'base' }>>([]);
  const [managersToAdd, setManagersToAdd]   = useState<Array<{ userId: string; team: 'home' | 'away' }>>([]);

  // ── Remove participant ──
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  function load() {
    if (!orgId || !gameId) return;
    setLoading(true);
    Promise.all([
      api.get<Game>(`/orgs/${orgId}/games/${gameId}`),
      api.get<Submission[]>(`/orgs/${orgId}/games/${gameId}/submissions`),
      api.get<GameIncident[]>(`/orgs/${orgId}/incidents?gameId=${gameId}`),
    ])
      .then(async ([gameRes, subRes, incRes]) => {
        setGame(gameRes.data);
        setIncidents(incRes.data);
        const sub = subRes.data[0] ?? null;
        setSubmission(sub);
        if (sub) {
          try {
            const detailRes = await api.get<AdminSubmissionDetail>(`/orgs/${orgId}/submissions/${sub.id}`);
            setSubDetail(detailRes.data);
          } catch { /* non-fatal */ }
        } else {
          setSubDetail(null);
        }
      })
      .catch(() => setError('Failed to load game.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orgId, gameId]);

  // Populate edit form when dialog opens
  function openEditDialog() {
    if (!game) return;
    const { location, fieldNumber } = parseLocation(game.location);
    setEditForm({
      title:       game.title,
      homeTeam:    game.homeTeam ?? '',
      awayTeam:    game.awayTeam ?? '',
      scheduledAt: toDatetimeLocal(game.scheduledAt),
      location,
      fieldNumber,
      level:       game.level ?? '',
      notes:       game.notes ?? '',
    });
    setEditError('');
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!orgId || !gameId) return;
    setEditSaving(true);
    setEditError('');
    const locationStr = [editForm.location, editForm.fieldNumber ? `Field ${editForm.fieldNumber}` : '']
      .filter(Boolean).join(' — ') || undefined;
    try {
      await api.patch(`/orgs/${orgId}/games/${gameId}`, {
        title:       editForm.title,
        scheduledAt: new Date(editForm.scheduledAt).toISOString(),
        ...(editForm.homeTeam && { homeTeam: editForm.homeTeam }),
        ...(editForm.awayTeam && { awayTeam: editForm.awayTeam }),
        ...(locationStr       && { location: locationStr }),
        ...(editForm.level    && { level:    editForm.level }),
        ...(editForm.notes    && { notes:    editForm.notes }),
      });
      setEditOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setEditError(msg ?? 'Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  }

  // Fetch org members when add-participants dialog opens
  useEffect(() => {
    if (!addOpen || !orgId) return;
    api.get<Array<{ userId: string; role: string; user: { firstName: string; lastName: string } }>>(
      `/orgs/${orgId}/members`,
    ).then(res => {
      const toSlim = (m: { userId: string; user: { firstName: string; lastName: string } }): SlimMember => ({
        userId: m.userId, firstName: m.user.firstName, lastName: m.user.lastName,
      });
      setOrgUmpires(res.data.filter(m => m.role === 'UMPIRE').map(toSlim));
      setOrgManagers(res.data.filter(m => m.role === 'MANAGER' || m.role === 'COACH').map(toSlim));
    }).catch(() => {});
  }, [addOpen, orgId]);

  function openAddDialog() {
    setUmpiresToAdd([]);
    setManagersToAdd([]);
    setPendingUmpire({ userId: '', position: 'plate' });
    setPendingManager({ userId: '', team: 'home' });
    setAddError('');
    setAddOpen(true);
  }

  function stageUmpire() {
    if (!pendingUmpire.userId) return;
    const alreadyOnGame = (game?.umpires ?? []).some(u => u.userId === pendingUmpire.userId);
    const alreadyStaged = umpiresToAdd.some(u => u.userId === pendingUmpire.userId);
    if (alreadyOnGame || alreadyStaged) return;
    setUmpiresToAdd(prev => [...prev, { ...pendingUmpire }]);
    setPendingUmpire({ userId: '', position: 'plate' });
  }

  function stageManager() {
    if (!pendingManager.userId) return;
    const alreadyOnGame = (game?.managers ?? []).some(m => m.userId === pendingManager.userId);
    const alreadyStaged = managersToAdd.some(m => m.userId === pendingManager.userId);
    if (alreadyOnGame || alreadyStaged) return;
    setManagersToAdd(prev => [...prev, { ...pendingManager }]);
    setPendingManager({ userId: '', team: 'home' });
  }

  async function handleAddParticipants() {
    if (!orgId || !gameId || !game) return;
    if (umpiresToAdd.length === 0 && managersToAdd.length === 0) { setAddOpen(false); return; }
    setAddSaving(true);
    setAddError('');
    try {
      const existingUmpires  = (game.umpires  ?? []).map(u => ({ userId: u.userId, position: u.position as 'plate' | 'base' }));
      const existingManagers = (game.managers ?? []).map(m => ({ userId: m.userId, team: m.team as 'home' | 'away' }));
      await api.patch(`/orgs/${orgId}/games/${gameId}`, {
        umpires:  [...existingUmpires,  ...umpiresToAdd],
        managers: [...existingManagers, ...managersToAdd],
      });
      setAddOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg ?? 'Failed to add participants.');
    } finally {
      setAddSaving(false);
    }
  }

  async function handleRemoveParticipant(type: 'umpire' | 'manager', userId: string) {
    if (!orgId || !gameId || !game) return;
    setRemoving(prev => new Set(prev).add(userId));
    try {
      const newUmpires  = (game.umpires  ?? [])
        .filter(u => type === 'manager' || u.userId !== userId)
        .map(u => ({ userId: u.userId, position: u.position as 'plate' | 'base' }));
      const newManagers = (game.managers ?? [])
        .filter(m => type === 'umpire'  || m.userId !== userId)
        .map(m => ({ userId: m.userId, team: m.team as 'home' | 'away' }));
      await api.patch(`/orgs/${orgId}/games/${gameId}`, { umpires: newUmpires, managers: newManagers });
      load();
    } catch { /* non-fatal */ } finally {
      setRemoving(prev => { const s = new Set(prev); s.delete(userId); return s; });
    }
  }

  async function handleRemind() {
    if (!orgId || !submission) return;
    setReminding(true);
    try { await api.post(`/orgs/${orgId}/submissions/${submission.id}/remind`); }
    finally { setReminding(false); }
  }

  async function handleOpenSubmission() {
    if (!orgId || !gameId) return;
    await api.post(`/orgs/${orgId}/games/${gameId}/submissions`).catch(() => null);
    load();
  }

  async function handleStatusChange(status: GameStatus) {
    if (!orgId || !gameId) return;
    setStatusUpdating(true);
    await api.patch(`/orgs/${orgId}/games/${gameId}`, { status }).catch(() => null);
    setStatusUpdating(false);
    load();
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (error || !game) return (
    <div>
      <button onClick={() => navigate('/admin/games')} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to games
      </button>
      <p className="text-destructive text-sm">{error || 'Game not found.'}</p>
    </div>
  );

  const umpires  = game.umpires  ?? [];
  const managers = game.managers ?? [];

  // Members already on the game (exclude from pickers)
  const assignedUmpireIds  = new Set([...umpires.map(u => u.userId), ...umpiresToAdd.map(u => u.userId)]);
  const assignedManagerIds = new Set([...managers.map(m => m.userId), ...managersToAdd.map(m => m.userId)]);
  const availableUmpires   = orgUmpires.filter(m => !assignedUmpireIds.has(m.userId));
  const availableManagers  = orgManagers.filter(m => !assignedManagerIds.has(m.userId));

  // Group coach ratings by umpire rated
  const coachRatingsByUmpire: Record<string, CoachRating[]> = {};
  for (const r of subDetail?.coachRatings ?? []) {
    if (!coachRatingsByUmpire[r.umpireId]) coachRatingsByUmpire[r.umpireId] = [];
    coachRatingsByUmpire[r.umpireId].push(r);
  }

  // Group umpire ratings by manager rated
  const umpireRatingsByManager: Record<string, UmpireRating[]> = {};
  for (const r of subDetail?.umpireRatings ?? []) {
    if (!umpireRatingsByManager[r.managerId]) umpireRatingsByManager[r.managerId] = [];
    umpireRatingsByManager[r.managerId].push(r);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/games')}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to games
      </button>

      {/* Game info card */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              {game.hasIncident && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" title="Incident reported for this game" />}
              <h1 className="text-xl font-bold">{game.title}</h1>
            </div>
            {(game.homeTeam || game.awayTeam) && (
              <p className="text-muted-foreground text-sm mt-0.5">
                {game.homeTeam ?? '?'} vs {game.awayTeam ?? '?'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openEditDialog}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Select value={game.status} onValueChange={v => handleStatusChange(v as GameStatus)} disabled={statusUpdating}>
              <SelectTrigger className={cn('w-36 text-xs', STATUS_CLASSES[game.status])}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Date & Time</p>
            <p>{formatDateTime(game.scheduledAt)}</p>
          </div>
          {game.location && (
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Location</p>
              <p>{game.location}</p>
            </div>
          )}
          {game.level && (
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Level</p>
              <p>{game.level}</p>
            </div>
          )}
        </div>

        {game.notes && (
          <div className="text-sm text-muted-foreground border-t border-border pt-3">{game.notes}</div>
        )}
      </div>

      {/* Participants */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
          <h2 className="text-sm font-semibold">Participants</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openAddDialog}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add participants
            </Button>
            {submission ? (
              <>
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                  submission.status === 'SUBMITTED'
                    ? 'bg-green-500/15 text-green-400 border-green-500/20'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/20',
                )}>
                  {submission.status === 'SUBMITTED' ? 'Submitted' : 'Pending'}
                </span>
                {submission.status === 'PENDING' && (
                  <Button size="sm" variant="outline" onClick={handleRemind} disabled={reminding}>
                    <Bell className="h-3.5 w-3.5 mr-1.5" />
                    {reminding ? 'Sending…' : 'Remind all'}
                  </Button>
                )}
              </>
            ) : game.status === 'COMPLETED' ? (
              <Button size="sm" variant="outline" onClick={handleOpenSubmission}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Open submission
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">No submission yet</span>
            )}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Role</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Position / Team</th>
              <th className="text-left px-4 py-2.5 font-medium">Submission</th>
              <th className="px-4 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {umpires.map(u => (
              <tr
                key={u.id}
                className="hover:bg-muted/20 cursor-pointer transition-colors"
                onClick={() => navigate(`/admin/members/${u.userId}`)}
              >
                <td className="px-4 py-3 font-medium">
                  {u.user?.firstName} {u.user?.lastName}
                  <p className="text-xs text-muted-foreground font-normal">{u.user?.email}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">Umpire</td>
                <td className="px-4 py-3 text-muted-foreground capitalize hidden sm:table-cell">{u.position}</td>
                <td className="px-4 py-3">
                  {submission ? (
                    submission.status === 'SUBMITTED' ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 text-xs">
                        <Clock className="h-3.5 w-3.5" /> Pending
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={e => { e.stopPropagation(); handleRemoveParticipant('umpire', u.userId); }}
                    disabled={removing.has(u.userId)}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {managers.map(m => (
              <tr
                key={m.id}
                className="hover:bg-muted/20 cursor-pointer transition-colors"
                onClick={() => navigate(`/admin/members/${m.userId}`)}
              >
                <td className="px-4 py-3 font-medium">
                  {m.user?.firstName} {m.user?.lastName}
                  <p className="text-xs text-muted-foreground font-normal">{m.user?.email}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">Manager</td>
                <td className="px-4 py-3 text-muted-foreground capitalize hidden sm:table-cell">{m.team}</td>
                <td className="px-4 py-3">
                  {submission ? (
                    submission.status === 'SUBMITTED' ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 text-xs">
                        <Clock className="h-3.5 w-3.5" /> Pending
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={e => { e.stopPropagation(); handleRemoveParticipant('manager', m.userId); }}
                    disabled={removing.has(m.userId)}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {umpires.length === 0 && managers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
                  No participants assigned to this game.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="rounded-lg border border-destructive/30 overflow-hidden">
          <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/30 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <h2 className="font-semibold text-destructive">Incidents ({incidents.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {incidents.map(inc => (
              <div key={inc.id} className="px-4 py-4 space-y-2 bg-destructive/5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{inc.title}</p>
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
                <p className="text-sm text-muted-foreground leading-relaxed">{inc.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span>Filed by <span className="text-foreground">{inc.reporter.firstName} {inc.reporter.lastName}</span></span>
                  <span>Against <span className="text-foreground">{inc.subject.firstName} {inc.subject.lastName}</span></span>
                  <span className="ml-auto">{formatDate(inc.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission Results */}
      {subDetail && (subDetail.coachRatings.length > 0 || subDetail.umpireRatings.length > 0) && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border">
            <h2 className="font-semibold">Submission Results</h2>
          </div>
          <div className="p-4 space-y-6">
            {Object.keys(coachRatingsByUmpire).length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Manager Ratings of Umpires
                </p>
                {Object.entries(coachRatingsByUmpire).map(([umpireId, ratings]) => {
                  const umpireEntry = subDetail.game.umpires.find(u => u.user?.id === umpireId);
                  const umpireName  = umpireEntry?.user
                    ? `${umpireEntry.user.firstName} ${umpireEntry.user.lastName}`
                    : 'Unknown Umpire';
                  return (
                    <div key={umpireId} className="rounded-lg border border-border overflow-hidden">
                      <div className="px-4 py-2.5 bg-muted/20 border-b border-border">
                        <p className="text-sm font-semibold">{umpireName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{umpireEntry?.position ?? 'umpire'}</p>
                      </div>
                      <div className="divide-y divide-border">
                        {ratings.map(r => (
                          <div key={r.id} className="px-4 py-3 space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Rated by <span className="text-foreground font-medium">{r.coach.firstName} {r.coach.lastName}</span>
                            </p>
                            {r.noShow ? (
                              <p className="text-sm text-amber-400 italic">Marked as no-show</p>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                  {COACH_CATS.map(cat => (
                                    <ScoreChip key={cat.key} label={cat.label} value={(r as Record<string, number | null>)[cat.key]} />
                                  ))}
                                </div>
                                {r.comments && (
                                  <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{r.comments}</p>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {Object.keys(coachRatingsByUmpire).length > 0 && Object.keys(umpireRatingsByManager).length > 0 && (
              <Separator />
            )}

            {Object.keys(umpireRatingsByManager).length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Umpire Ratings of Managers
                </p>
                {Object.entries(umpireRatingsByManager).map(([managerId, ratings]) => {
                  const managerEntry = subDetail.game.managers.find(m => m.user?.id === managerId);
                  const managerName  = managerEntry?.user
                    ? `${managerEntry.user.firstName} ${managerEntry.user.lastName}`
                    : 'Unknown Manager';
                  return (
                    <div key={managerId} className="rounded-lg border border-border overflow-hidden">
                      <div className="px-4 py-2.5 bg-muted/20 border-b border-border">
                        <p className="text-sm font-semibold">{managerName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{managerEntry?.team ?? ''} manager</p>
                      </div>
                      <div className="divide-y divide-border">
                        {ratings.map(r => (
                          <div key={r.id} className="px-4 py-3 space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Rated by <span className="text-foreground font-medium">{r.umpire.firstName} {r.umpire.lastName}</span>
                            </p>
                            {r.noShow ? (
                              <p className="text-sm text-amber-400 italic">Marked as no-show</p>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {UMPIRE_CATS.map(cat => (
                                    <ScoreChip key={cat.key} label={cat.label} value={(r as Record<string, number | null>)[cat.key]} />
                                  ))}
                                </div>
                                {r.comments && (
                                  <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{r.comments}</p>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit game dialog ── */}
      <Dialog open={editOpen} onOpenChange={o => { setEditOpen(o); if (!o) setEditError(''); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit game</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Home team</Label>
                <Input placeholder="Tigers" value={editForm.homeTeam} onChange={e => setEditForm(p => ({ ...p, homeTeam: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Away team</Label>
                <Input placeholder="Eagles" value={editForm.awayTeam} onChange={e => setEditForm(p => ({ ...p, awayTeam: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date & time <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" value={editForm.scheduledAt} onChange={e => setEditForm(p => ({ ...p, scheduledAt: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="Riverside Park" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Field #</Label>
                <Input placeholder="3" value={editForm.fieldNumber} onChange={e => setEditForm(p => ({ ...p, fieldNumber: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Input placeholder="Varsity" value={editForm.level} onChange={e => setEditForm(p => ({ ...p, level: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editForm.title || !editForm.scheduledAt}>
              {editSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add participants dialog ── */}
      <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) setAddError(''); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add participants</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">

            {/* Umpires */}
            <div className="space-y-2">
              <Label>Umpires</Label>
              {umpiresToAdd.length > 0 && (
                <div className="space-y-1.5">
                  {umpiresToAdd.map(a => {
                    const m = orgUmpires.find(u => u.userId === a.userId);
                    return (
                      <div key={a.userId} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2 text-sm">
                        <span>{m?.firstName} {m?.lastName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize">{a.position}</span>
                          <button onClick={() => setUmpiresToAdd(prev => prev.filter(u => u.userId !== a.userId))} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {availableUmpires.length > 0 ? (
                <div className="flex gap-2">
                  <MemberPicker
                    members={availableUmpires}
                    selectedId={pendingUmpire.userId}
                    placeholder="Search umpire…"
                    onSelect={m => setPendingUmpire(p => ({ ...p, userId: m?.userId ?? '' }))}
                  />
                  <Select value={pendingUmpire.position} onValueChange={v => setPendingUmpire(p => ({ ...p, position: v as 'plate' | 'base' }))}>
                    <SelectTrigger className="w-24 text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plate">Plate</SelectItem>
                      <SelectItem value="base">Base</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" onClick={stageUmpire} disabled={!pendingUmpire.userId}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">All umpires already assigned.</p>
              )}
            </div>

            <Separator />

            {/* Managers */}
            <div className="space-y-2">
              <Label>Managers</Label>
              {managersToAdd.length > 0 && (
                <div className="space-y-1.5">
                  {managersToAdd.map(a => {
                    const m = orgManagers.find(u => u.userId === a.userId);
                    return (
                      <div key={a.userId} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2 text-sm">
                        <span>{m?.firstName} {m?.lastName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize">{a.team} team</span>
                          <button onClick={() => setManagersToAdd(prev => prev.filter(u => u.userId !== a.userId))} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {availableManagers.length > 0 ? (
                <div className="flex gap-2">
                  <MemberPicker
                    members={availableManagers}
                    selectedId={pendingManager.userId}
                    placeholder="Search manager…"
                    onSelect={m => setPendingManager(p => ({ ...p, userId: m?.userId ?? '' }))}
                  />
                  <Select value={pendingManager.team} onValueChange={v => setPendingManager(p => ({ ...p, team: v as 'home' | 'away' }))}>
                    <SelectTrigger className="w-24 text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="away">Away</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" onClick={stageManager} disabled={!pendingManager.userId}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">All managers already assigned.</p>
              )}
            </div>

            {addError && <p className="text-sm text-destructive">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddParticipants}
              disabled={addSaving || (umpiresToAdd.length === 0 && managersToAdd.length === 0)}
            >
              {addSaving ? 'Saving…' : 'Add participants'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
