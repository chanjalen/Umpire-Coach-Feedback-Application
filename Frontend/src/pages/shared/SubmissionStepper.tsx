import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Person {
  id: string;
  firstName: string;
  lastName: string;
}

interface MyCoachRating {
  umpireId: string;
  noShow: boolean;
  appearance: number | null;
  judgment: number | null;
  mechanics: number | null;
  gameControl: number | null;
  composure: number | null;
  attitude: number | null;
  comments: string | null;
}

interface MyUmpireRating {
  managerId: string;
  noShow: boolean;
  sportsmanship: number | null;
  cooperation: number | null;
  comments: string | null;
}

interface SubmissionDetail {
  id: string;
  gameId: string;
  status: 'PENDING' | 'SUBMITTED';
  myRatingsSubmitted?: boolean;
  mySubmittedRatings?: MyCoachRating[] | MyUmpireRating[];
  game: {
    title: string;
    scheduledAt: string;
    homeTeam?: string;
    awayTeam?: string;
    umpires:  Array<{ userId: string; position: string; user?: { id: string; firstName: string; lastName: string } }>;
    managers: Array<{ userId: string; team: string;     user?: { id: string; firstName: string; lastName: string } }>;
  };
}

// ─── Coach → Umpire rating ────────────────────────────────────────────────────

interface CoachRating {
  noShow: boolean;
  appearance: number | null;
  judgment: number | null;
  mechanics: number | null;
  gameControl: number | null;
  composure: number | null;
  attitude: number | null;
  comments: string;
}

const COACH_CATEGORIES: Array<{ key: keyof CoachRating; label: string }> = [
  { key: 'appearance',  label: 'Appearance'  },
  { key: 'judgment',    label: 'Judgment'    },
  { key: 'mechanics',   label: 'Mechanics'   },
  { key: 'gameControl', label: 'Game Control' },
  { key: 'composure',   label: 'Composure'   },
  { key: 'attitude',    label: 'Attitude'    },
];

function emptyCoachRating(): CoachRating {
  return { noShow: false, appearance: null, judgment: null, mechanics: null, gameControl: null, composure: null, attitude: null, comments: '' };
}

// ─── Umpire → Manager rating ──────────────────────────────────────────────────

interface UmpireRating {
  noShow: boolean;
  sportsmanship: number | null;
  cooperation: number | null;
  comments: string;
}

const UMPIRE_CATEGORIES: Array<{ key: keyof UmpireRating; label: string }> = [
  { key: 'sportsmanship', label: 'Sportsmanship' },
  { key: 'cooperation',   label: 'Cooperation'   },
];

function emptyUmpireRating(): UmpireRating {
  return { noShow: false, sportsmanship: null, cooperation: null, comments: '' };
}

// ─── My filed incident (for read-only view) ───────────────────────────────────

interface MyFiledIncident {
  id: string;
  title: string;
  description: string;
  resolvedAt: string | null;
  createdAt: string;
  game: { id: string; title: string } | null;
}

// ─── Incident state ───────────────────────────────────────────────────────────

interface IncidentDraft {
  subjectId: string;
  title: string;
  description: string;
}

// ─── Rating button strip ──────────────────────────────────────────────────────

const RATING_LABELS = ['', 'Poor', 'Below Expectations', 'Meets Expectations', 'Strong Performance', 'Exceptional'];

function RatingButtons({ value, onChange, disabled }: {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          title={RATING_LABELS[n]}
          className={cn(
            'flex-1 h-12 rounded-lg text-lg font-bold border-2 transition-all',
            value === n
              ? 'bg-primary border-primary text-primary-foreground shadow-md scale-105'
              : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground hover:bg-primary/5',
            disabled && 'opacity-40 cursor-not-allowed',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── Read-only view (already submitted) ──────────────────────────────────────

function ReadOnlyView({ submission, isManager, myIncident, onBack }: {
  submission: SubmissionDetail;
  isManager: boolean;
  myIncident: MyFiledIncident | null;
  onBack: () => void;
}) {
  const coachRatings  = isManager  ? (submission.mySubmittedRatings as MyCoachRating[]  ?? []) : [];
  const umpireRatings = !isManager ? (submission.mySubmittedRatings as MyUmpireRating[] ?? []) : [];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{submission.game.title}</p>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          <h1 className="text-lg font-bold">Your submitted ratings</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{formatDateTime(submission.game.scheduledAt)}</p>
      </div>

      <Separator />

      <div className="space-y-4">
        {isManager
          ? coachRatings.map((r, i) => {
              const entry = submission.game.umpires.find(u => u.user?.id === r.umpireId);
              const name  = entry?.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown';
              return (
                <RatedCard key={i} name={name} role={entry?.position ?? 'umpire'} noShow={r.noShow} comments={r.comments}>
                  {COACH_CATEGORIES.map(cat => (
                    <ScoreRow key={cat.key} label={cat.label} value={(r as Record<string, number | null>)[cat.key]} />
                  ))}
                </RatedCard>
              );
            })
          : umpireRatings.map((r, i) => {
              const entry = submission.game.managers.find(m => m.user?.id === r.managerId);
              const name  = entry?.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown';
              return (
                <RatedCard key={i} name={name} role={`${entry?.team ?? ''} manager`} noShow={r.noShow} comments={r.comments}>
                  {UMPIRE_CATEGORIES.map(cat => (
                    <ScoreRow key={cat.key} label={cat.label} value={(r as Record<string, number | null>)[cat.key]} />
                  ))}
                </RatedCard>
              );
            })}
      </div>

      {/* ── Incident filed for this game ──────────────────────────────────── */}
      {myIncident && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Incident You Reported
            </p>
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{myIncident.title}</p>
                {myIncident.resolvedAt ? (
                  <span className="flex items-center gap-1 text-green-400 text-xs shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400 text-xs shrink-0">
                    <Clock className="h-3.5 w-3.5" /> Open
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{myIncident.description}</p>
              <p className="text-xs text-muted-foreground">Filed {formatDate(myIncident.createdAt)}</p>
            </div>
          </div>
        </>
      )}

      <Button variant="outline" className="w-full" onClick={onBack}>Done</Button>
    </div>
  );
}

function RatedCard({ name, role, noShow, comments, children }: {
  name: string; role: string; noShow: boolean; comments: string | null; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div>
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground capitalize">{role}</p>
      </div>
      {noShow ? (
        <p className="text-sm text-amber-400 italic">Marked as no-show</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">{children}</div>
          {comments && <p className="text-sm text-muted-foreground border-l-2 border-border pl-3 pt-1">{comments}</p>}
        </>
      )}
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between bg-muted/20 rounded px-2 py-1.5 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-bold">
        {value ?? '—'}{value != null && <span className="text-xs text-muted-foreground font-normal"> /5</span>}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubmissionStepper() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { orgId, orgRole, user } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [phase, setPhase]           = useState<'incident-gate' | 'rating'>('incident-gate');
  const [step, setStep]             = useState(0);
  const [done, setDone]             = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Rating state
  const [coachRatings,  setCoachRatings]  = useState<Record<string, CoachRating>>({});
  const [umpireRatings, setUmpireRatings] = useState<Record<string, UmpireRating>>({});

  // Incident state
  const [incidentEnabled, setIncidentEnabled] = useState(false);
  const [incident, setIncident] = useState<IncidentDraft>({
    subjectId: '', title: '', description: '',
  });
  const [incidentError, setIncidentError] = useState('');
  const [myIncident, setMyIncident]       = useState<MyFiledIncident | null>(null);

  useEffect(() => {
    if (!orgId || !submissionId) return;
    api.get<SubmissionDetail>(`/orgs/${orgId}/submissions/${submissionId}`)
      .then(res => {
        setSubmission(res.data);
        // Fetch incidents filed by this user and find one matching this game
        api.get<MyFiledIncident[]>(`/orgs/${orgId}/incidents/mine`)
          .then(r => {
            const match = r.data.find(i => i.game?.id === res.data.gameId) ?? null;
            setMyIncident(match);
          })
          .catch(() => {});
      })
      .catch(() => setError('Failed to load submission.'))
      .finally(() => setLoading(false));
  }, [orgId, submissionId]);

  const isManager = orgRole === 'MANAGER' || orgRole === 'COACH';

  // Destination after submitting new ratings
  const submissionsPath = orgRole === 'UMPIRE' ? '/umpire/submissions' : '/manager/submissions';

  // Who this user needs to rate
  const people: Person[] = (() => {
    if (!submission) return [];
    if (isManager) {
      return submission.game.umpires
        .filter(u => u.user)
        .map(u => ({ id: u.user!.id, firstName: u.user!.firstName, lastName: u.user!.lastName }));
    }
    if (orgRole === 'UMPIRE') {
      return submission.game.managers
        .filter(m => m.user)
        .map(m => ({ id: m.user!.id, firstName: m.user!.firstName, lastName: m.user!.lastName }));
    }
    return [];
  })();

  // All participants for incident subject (excluding self)
  const allParticipants = submission ? [
    ...submission.game.umpires
      .filter(u => u.user && u.user.id !== user?.id)
      .map(u => ({ id: u.user!.id, name: `${u.user!.firstName} ${u.user!.lastName}`, role: `${u.position} umpire` })),
    ...submission.game.managers
      .filter(m => m.user && m.user.id !== user?.id)
      .map(m => ({ id: m.user!.id, name: `${m.user!.firstName} ${m.user!.lastName}`, role: `${m.team} manager` })),
  ] : [];

  const currentPerson = people[step];
  const isLastStep    = step === people.length - 1;

  // Incident validation
  const incidentValid = !incidentEnabled || (
    incident.subjectId.length > 0 &&
    incident.title.trim().length > 0 &&
    incident.description.trim().length > 0
  );

  function getCoachRating(id: string): CoachRating {
    return coachRatings[id] ?? emptyCoachRating();
  }
  function setCoachRating(id: string, patch: Partial<CoachRating>) {
    setCoachRatings(prev => ({ ...prev, [id]: { ...getCoachRating(id), ...patch } }));
  }
  function getUmpireRating(id: string): UmpireRating {
    return umpireRatings[id] ?? emptyUmpireRating();
  }
  function setUmpireRating(id: string, patch: Partial<UmpireRating>) {
    setUmpireRatings(prev => ({ ...prev, [id]: { ...getUmpireRating(id), ...patch } }));
  }

  function canProceed(): boolean {
    if (!currentPerson) return false;
    if (isManager) {
      const r = getCoachRating(currentPerson.id);
      return r.noShow || r.appearance !== null;
    } else {
      const r = getUmpireRating(currentPerson.id);
      return r.noShow || r.sportsmanship !== null;
    }
  }

  async function handleSubmitAll() {
    if (!orgId || !submissionId || !user) return;
    setSubmitting(true);
    setIncidentError('');
    try {
      // Submit ratings
      if (isManager) {
        for (const p of people) {
          const r = getCoachRating(p.id);
          await api.post(`/orgs/${orgId}/submissions/${submissionId}/coach-ratings`, {
            umpireId: p.id,
            noShow: r.noShow,
            ...(r.noShow ? {} : {
              appearance: r.appearance, judgment: r.judgment, mechanics: r.mechanics,
              gameControl: r.gameControl, composure: r.composure, attitude: r.attitude,
            }),
            comments: r.comments || undefined,
          });
        }
      } else {
        for (const p of people) {
          const r = getUmpireRating(p.id);
          await api.post(`/orgs/${orgId}/submissions/${submissionId}/umpire-ratings`, {
            managerId: p.id,
            noShow: r.noShow,
            ...(r.noShow ? {} : { sportsmanship: r.sportsmanship, cooperation: r.cooperation }),
            comments: r.comments || undefined,
          });
        }
      }

      // Submit incident if flagged
      if (incidentEnabled && incidentValid) {
        try {
          await api.post(`/orgs/${orgId}/incidents`, {
            gameId:      submission!.gameId,
            subjectId:   incident.subjectId,
            title:       incident.title.trim(),
            description: incident.description.trim(),
          });
        } catch {
          setIncidentError('Ratings submitted, but the incident could not be saved. Please report it separately.');
        }
      }

      setDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to submit. Please try again.');
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="max-w-lg mx-auto space-y-4 pt-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (error) return (
    <div className="max-w-lg mx-auto pt-4">
      <p className="text-destructive text-sm">{error}</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
    </div>
  );

  if (!submission) return null;

  // ── Already submitted → read-only ──────────────────────────────────────────
  if (submission.myRatingsSubmitted) {
    return (
      <ReadOnlyView
        submission={submission}
        isManager={isManager}
        myIncident={myIncident}
        onBack={() => navigate(-1)}
      />
    );
  }

  // ── Submission closed, user never rated ────────────────────────────────────
  if (submission.status === 'SUBMITTED') {
    return (
      <div className="max-w-lg mx-auto pt-8 text-center space-y-2">
        <p className="font-semibold">Submission closed</p>
        <p className="text-muted-foreground text-sm">
          This submission for <span className="text-foreground">{submission.game.title}</span> has been closed. You did not submit any ratings.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) return (
    <div className="max-w-lg mx-auto pt-8 flex flex-col items-center gap-4 text-center">
      <div className="p-4 rounded-full bg-green-500/15">
        <CheckCircle2 className="h-10 w-10 text-green-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Submission complete</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Your ratings for <span className="text-foreground font-medium">{submission.game.title}</span> have been submitted.
        </p>
        {incidentError && (
          <p className="text-amber-400 text-xs mt-3 max-w-xs mx-auto">{incidentError}</p>
        )}
      </div>
      {/* Navigate to submissions page so list re-fetches with correct status */}
      <Button onClick={() => navigate(submissionsPath, { replace: true })} className="mt-2">Done</Button>
    </div>
  );

  // ── No people to rate ──────────────────────────────────────────────────────
  if (people.length === 0) return (
    <div className="max-w-lg mx-auto pt-8 text-center">
      <p className="text-muted-foreground text-sm">No participants to rate for this game.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
    </div>
  );

  // ── Incident gate ──────────────────────────────────────────────────────────
  if (phase === 'incident-gate') return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{submission.game.title}</p>
        <h1 className="text-lg font-bold">Report an incident?</h1>
        <p className="text-muted-foreground text-sm mt-1">
          If something happened during this game that should be reported, you can log it before submitting your ratings.
        </p>
      </div>

      <Separator />

      {!incidentEnabled ? (
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="justify-start gap-2 h-auto py-3 px-4 text-left"
            onClick={() => setIncidentEnabled(true)}
          >
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <p className="font-medium">Yes, report an incident</p>
              <p className="text-xs text-muted-foreground font-normal">Log a concern for admin review</p>
            </div>
          </Button>
          <Button onClick={() => setPhase('rating')} className="justify-start gap-2 h-auto py-3 px-4 text-left">
            <div>
              <p className="font-medium">No, continue to ratings</p>
              <p className="text-xs opacity-70 font-normal">Skip and go straight to rating</p>
            </div>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subject <span className="text-destructive">*</span></label>
            <select
              value={incident.subjectId}
              onChange={e => setIncident(prev => ({ ...prev, subjectId: e.target.value }))}
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              <option value="">Select person involved…</option>
              {allParticipants.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title <span className="text-destructive">*</span></label>
            <input
              type="text"
              placeholder="Brief description of the incident"
              value={incident.title}
              onChange={e => setIncident(prev => ({ ...prev, title: e.target.value }))}
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 placeholder:text-muted-foreground text-foreground"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Provide details about what happened…"
              value={incident.description}
              onChange={e => setIncident(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-none"
              onClick={() => { setIncidentEnabled(false); setIncident({ subjectId: '', title: '', description: '' }); }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!incidentValid}
              onClick={() => setPhase('rating')}
            >
              Continue to ratings
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Rating form ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-7rem)]">
      {/* Game header */}
      <div className="pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          {submission.game.title}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{isManager ? 'Rate umpire' : 'Rate manager'}</h1>
          <span className="text-xs text-muted-foreground">Step {step + 1} of {people.length}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / people.length) * 100}%` }}
          />
        </div>
      </div>

      <Separator />

      {/* Person being rated */}
      <div className="py-5 flex-1 space-y-6">
        <div>
          <h2 className="text-xl font-bold">{currentPerson.firstName} {currentPerson.lastName}</h2>
          {isManager ? (
            <p className="text-sm text-muted-foreground">
              {submission.game.umpires.find(u => u.user?.id === currentPerson.id)?.position ?? 'Umpire'}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {submission.game.managers.find(m => m.user?.id === currentPerson.id)?.team ?? ''} manager
            </p>
          )}
        </div>

        {/* No-show toggle */}
        <div className="flex items-center gap-3">
          <input
            id="noShow"
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            checked={isManager ? getCoachRating(currentPerson.id).noShow : getUmpireRating(currentPerson.id).noShow}
            onChange={e => {
              if (isManager) setCoachRating(currentPerson.id, { noShow: e.target.checked });
              else setUmpireRating(currentPerson.id, { noShow: e.target.checked });
            }}
          />
          <label htmlFor="noShow" className="text-sm text-muted-foreground cursor-pointer">
            Did not show / no-show
          </label>
        </div>

        {/* Rating categories */}
        {isManager ? (
          <>
            {!getCoachRating(currentPerson.id).noShow && (
              <div className="space-y-5">
                {COACH_CATEGORIES.map(cat => (
                  <div key={cat.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{cat.label}</label>
                      {getCoachRating(currentPerson.id)[cat.key] !== null && (
                        <span className="text-xs text-muted-foreground">
                          {RATING_LABELS[getCoachRating(currentPerson.id)[cat.key] as number]}
                        </span>
                      )}
                    </div>
                    <RatingButtons
                      value={getCoachRating(currentPerson.id)[cat.key] as number | null}
                      onChange={v => setCoachRating(currentPerson.id, { [cat.key]: v })}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Comments (optional)</label>
              <Textarea
                placeholder="Any additional comments…"
                value={getCoachRating(currentPerson.id).comments}
                onChange={e => setCoachRating(currentPerson.id, { comments: e.target.value })}
                rows={3}
              />
            </div>
          </>
        ) : (
          <>
            {!getUmpireRating(currentPerson.id).noShow && (
              <div className="space-y-5">
                {UMPIRE_CATEGORIES.map(cat => (
                  <div key={cat.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{cat.label}</label>
                      {getUmpireRating(currentPerson.id)[cat.key] !== null && (
                        <span className="text-xs text-muted-foreground">
                          {RATING_LABELS[getUmpireRating(currentPerson.id)[cat.key] as number]}
                        </span>
                      )}
                    </div>
                    <RatingButtons
                      value={getUmpireRating(currentPerson.id)[cat.key] as number | null}
                      onChange={v => setUmpireRating(currentPerson.id, { [cat.key]: v })}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Comments (optional)</label>
              <Textarea
                placeholder="Any additional comments…"
                value={getUmpireRating(currentPerson.id).comments}
                onChange={e => setUmpireRating(currentPerson.id, { comments: e.target.value })}
                rows={3}
              />
            </div>
          </>
        )}

      </div>

      {/* Sticky nav */}
      <div className="sticky bottom-0 bg-background border-t border-border pt-4 pb-2 flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="flex-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {isLastStep ? (
          <Button
            className="flex-1"
            onClick={handleSubmitAll}
            disabled={!canProceed() || submitting}
          >
            {submitting ? 'Submitting…' : 'Submit all ratings'}
          </Button>
        ) : (
          <Button
            className="flex-1"
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
