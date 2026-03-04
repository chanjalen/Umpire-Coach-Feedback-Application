import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { Incident } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatDate } from '@/lib/utils';
import { CheckCheck, Undo2 } from 'lucide-react';

function IncidentCard({
  incident,
  onSelect,
  onToggleResolve,
}: {
  incident: Incident;
  onSelect: () => void;
  onToggleResolve: () => void;
}) {
  const isResolved = !!incident.resolvedAt;
  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-3 cursor-pointer transition-colors',
        isResolved
          ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
          : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={e => { e.stopPropagation(); onToggleResolve(); }}
          className={cn(
            'p-1.5 rounded transition-colors',
            isResolved
              ? 'text-green-400 hover:text-amber-400'
              : 'text-destructive hover:text-green-400',
          )}
          title={isResolved ? 'Reopen' : 'Mark resolved'}
        >
          {isResolved ? <Undo2 className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
        </button>
      </div>

      <div>
        <p className="font-medium text-sm leading-snug">{incident.title}</p>
        {incident.game && (
          <p className="text-xs text-muted-foreground mt-0.5">{incident.game.title}</p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {incident.reporter
            ? `Filed by ${incident.reporter.firstName} ${incident.reporter.lastName}`
            : 'Unknown reporter'}
        </span>
        <span>{formatDate(incident.createdAt)}</span>
      </div>

      {incident.subject && (
        <div className={cn('text-xs text-muted-foreground border-t pt-2', isResolved ? 'border-green-500/20' : 'border-destructive/20')}>
          Subject: {incident.subject.firstName} {incident.subject.lastName}
        </div>
      )}
    </div>
  );
}

export default function AdminIncidents() {
  const { orgId } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState<Incident | null>(null);

  function load() {
    if (!orgId) return;
    api.get<Incident[]>(`/orgs/${orgId}/incidents`)
      .then(res => setIncidents(res.data))
      .catch(() => setError('Failed to load incidents.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orgId]);

  async function handleToggleResolve(incident: Incident) {
    if (!orgId) return;
    const resolved = !incident.resolvedAt;
    await api.patch(`/orgs/${orgId}/incidents/${incident.id}/resolve`, { resolved }).catch(() => null);
    load();
    // Update selected if open
    setSelected(prev => prev?.id === incident.id ? { ...prev, resolvedAt: resolved ? new Date().toISOString() : undefined } : prev);
  }

  const open     = incidents.filter(i => !i.resolvedAt);
  const resolved = incidents.filter(i => !!i.resolvedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {open.length} open · {resolved.length} resolved
        </p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Open column */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Open ({open.length})
            </h2>
            {open.length === 0 ? (
              <p className="text-muted-foreground text-sm">No open incidents.</p>
            ) : (
              open.map(i => (
                <IncidentCard
                  key={i.id}
                  incident={i}
                  onSelect={() => setSelected(i)}
                  onToggleResolve={() => handleToggleResolve(i)}
                />
              ))
            )}
          </div>

          {/* Resolved column */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resolved ({resolved.length})
            </h2>
            {resolved.length === 0 ? (
              <p className="text-muted-foreground text-sm">No resolved incidents.</p>
            ) : (
              resolved.map(i => (
                <IncidentCard
                  key={i.id}
                  incident={i}
                  onSelect={() => setSelected(i)}
                  onToggleResolve={() => handleToggleResolve(i)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 text-sm">
                <p className="text-muted-foreground leading-relaxed">{selected.description}</p>

                <div className="grid grid-cols-2 gap-3">
                  {selected.game && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Game</p>
                      <p className="font-medium">{selected.game.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selected.game.scheduledAt)}</p>
                    </div>
                  )}
                  {selected.subject && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Subject</p>
                      <p className="font-medium">{selected.subject.firstName} {selected.subject.lastName}</p>
                      <p className="text-xs text-muted-foreground">{selected.subject.email}</p>
                    </div>
                  )}
                  {selected.reporter && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Filed by</p>
                      <p className="font-medium">{selected.reporter.firstName} {selected.reporter.lastName}</p>
                      <p className="text-xs text-muted-foreground">{selected.reporter.email}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selected.createdAt)}</p>
                    </div>
                  )}
                  {selected.resolvedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Resolved</p>
                      <p>{formatDate(selected.resolvedAt)}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button
                    variant={selected.resolvedAt ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => { handleToggleResolve(selected); setSelected(null); }}
                  >
                    {selected.resolvedAt ? 'Reopen' : 'Mark resolved'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
