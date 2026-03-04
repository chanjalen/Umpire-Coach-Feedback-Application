import { useState, useRef, ChangeEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── System field definitions ─────────────────────────────────────────────────

interface SystemField {
  key: string;
  label: string;
  required: boolean;
}

const SYSTEM_FIELDS: SystemField[] = [
  { key: 'date',          label: 'Date',            required: true  },
  { key: 'time',          label: 'Time',            required: true  },
  { key: 'homeTeam',      label: 'Home Team',       required: true  },
  { key: 'homeTeamEmail', label: 'Home Team Email', required: true  },
  { key: 'awayTeam',      label: 'Away Team',       required: true  },
  { key: 'awayTeamEmail', label: 'Away Team Email', required: true  },
  { key: 'location',      label: 'Location',        required: false },
  { key: 'field',         label: 'Field #',         required: false },
  { key: 'level',         label: 'Level',           required: false },
  { key: 'umpire1Email',  label: 'Umpire 1 Email',  required: false },
  { key: 'umpire2Email',  label: 'Umpire 2 Email',  required: false },
  { key: 'umpire3Email',  label: 'Umpire 3 Email',  required: false },
];

const SKIP = '__skip__';

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim()); current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

// ─── Auto-mapping ─────────────────────────────────────────────────────────────

const ALIASES: Record<string, string[]> = {
  date:          ['date', 'gamedate', 'eventdate', 'gamingdate'],
  time:          ['time', 'starttime', 'gametime', 'eventtime'],
  homeTeam:      ['hometeam', 'home', 'hometeamname', 'homeclub'],
  homeTeamEmail: ['hometeamemail', 'homecoachemail', 'homeemail', 'homemanageremail'],
  awayTeam:      ['awayteam', 'away', 'awayteamname', 'visitingteam', 'visitor'],
  awayTeamEmail: ['awayteamemail', 'awaycoachemail', 'awayemail', 'awaymanageremail'],
  location:      ['location', 'venue', 'locationname', 'park', 'site'],
  field:         ['field', 'fieldnumber', 'fieldno', 'fieldn', 'fieldnum'],
  level:         ['level', 'division', 'divisionlevelofplay', 'leaguelevel'],
  umpire1Email:  ['umpire1email', 'ump1email', 'umpire1', 'official1email'],
  umpire2Email:  ['umpire2email', 'ump2email', 'umpire2', 'official2email'],
  umpire3Email:  ['umpire3email', 'ump3email', 'umpire3', 'official3email'],
};

function autoMap(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [fieldKey, aliases] of Object.entries(ALIASES)) {
    for (const h of csvHeaders) {
      if (aliases.includes(norm(h))) { mapping[fieldKey] = h; break; }
    }
  }
  return mapping;
}

// ─── Client-side date/time parse check ───────────────────────────────────────

function canParseDateTime(dateStr: string, timeStr: string): boolean {
  if (!dateStr || !timeStr) return false;
  let d = dateStr.trim();
  const t = timeStr.trim().replace(/\s+/g, '').toUpperCase();

  const mdy = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) d = `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
  const mdyd = d.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyd) d = `${mdyd[3]}-${mdyd[1].padStart(2,'0')}-${mdyd[2].padStart(2,'0')}`;

  let isoTime = t;
  const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) isoTime = `${h24[1].padStart(2,'0')}:${h24[2]}:00`;
  const h12 = t.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (h12) {
    let h = parseInt(h12[1]);
    if (h12[3] === 'AM' && h === 12) h = 0;
    if (h12[3] === 'PM' && h !== 12) h += 12;
    isoTime = `${String(h).padStart(2,'0')}:${h12[2]}:00`;
  }

  return !isNaN(new Date(`${d}T${isoTime}`).getTime());
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'select' | 'map' | 'done';
interface ImportResult { created: number; skipped: number; warnings: string[] }

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminImport() {
  const { orgId } = useAuth();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [step, setStep]             = useState<Step>('select');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows]       = useState<Record<string, string>[]>([]);
  const [mapping, setMapping]       = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<ImportResult | null>(null);
  const [error, setError]           = useState('');

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers, rows } = parseCSV(ev.target?.result as string);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(autoMap(headers));
      setStep('map');
    };
    reader.readAsText(file);
  }

  function setFieldMapping(fieldKey: string, csvHeader: string) {
    setMapping(prev => ({ ...prev, [fieldKey]: csvHeader === SKIP ? '' : csvHeader }));
  }

  const validationErrors = SYSTEM_FIELDS
    .filter(f => f.required && !mapping[f.key])
    .map(f => `"${f.label}" is required but not mapped`);

  async function handleImport() {
    if (!orgId || validationErrors.length > 0) return;
    setSubmitting(true);
    setError('');

    const rows = csvRows.map(row => {
      const obj: Record<string, string> = {};
      for (const f of SYSTEM_FIELDS) {
        const col = mapping[f.key];
        if (col) obj[f.key] = row[col] ?? '';
      }
      return obj;
    });

    try {
      const res = await api.post<ImportResult>(`/orgs/${orgId}/games/import-rows`, { rows });
      setResult(res.data);
      setStep('done');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Import failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep('select');
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const previewRows = csvRows.slice(0, 5);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Games</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a CSV, map your columns to the expected fields, then import.
        </p>
      </div>

      {/* ── Step: Select ──────────────────────────────────────────────────── */}
      {step === 'select' && (
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg p-12 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
          <input ref={fileRef} type="file" accept=".csv" className="sr-only" onChange={handleFileChange} />
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Click to select a CSV file</p>
            <p className="text-xs text-muted-foreground mt-1">Parsed locally — you'll review before anything is created</p>
          </div>
        </label>
      )}

      {/* ── Step: Map + Preview ───────────────────────────────────────────── */}
      {step === 'map' && (
        <>
          {/* Column mapping */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Map Columns</h2>
              <span className="text-xs text-muted-foreground">{csvRows.length} rows in file</span>
            </div>

            <div className="divide-y divide-border">
              {SYSTEM_FIELDS.map(field => {
                const isMissing = field.required && !mapping[field.key];
                return (
                  <div key={field.key} className="px-4 py-2.5 flex items-center gap-4">
                    {/* System field label */}
                    <div className="w-40 shrink-0 flex items-center gap-1">
                      <span className={cn('text-sm', isMissing ? 'text-destructive font-medium' : 'font-medium')}>
                        {field.label}
                      </span>
                      {field.required && <span className="text-xs text-destructive">*</span>}
                    </div>

                    {/* Arrow */}
                    <span className="text-muted-foreground text-xs shrink-0">←</span>

                    {/* CSV column dropdown */}
                    <Select
                      value={mapping[field.key] || SKIP}
                      onValueChange={v => setFieldMapping(field.key, v)}
                    >
                      <SelectTrigger className={cn('h-8 text-xs w-56', isMissing && 'border-destructive')}>
                        <SelectValue placeholder="— Skip —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>— Skip —</SelectItem>
                        {csvHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <h2 className="font-semibold">
                Preview{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  (first {previewRows.length} of {csvRows.length} rows)
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-muted/20 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Time</th>
                    <th className="text-left px-3 py-2 font-medium">Home Team</th>
                    <th className="text-left px-3 py-2 font-medium">Away Team</th>
                    <th className="text-left px-3 py-2 font-medium">Location / Field</th>
                    <th className="text-left px-3 py-2 font-medium">Umpires</th>
                    <th className="text-left px-3 py-2 font-medium">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewRows.map((row, i) => {
                    const dateVal = mapping.date ? row[mapping.date] ?? '' : '';
                    const timeVal = mapping.time ? row[mapping.time] ?? '' : '';
                    const dateOk  = dateVal && timeVal ? canParseDateTime(dateVal, timeVal) : true;
                    const loc     = [
                      mapping.location ? row[mapping.location] : '',
                      mapping.field    ? row[mapping.field]    : '',
                    ].filter(Boolean).join(' / ');
                    const umpires = [mapping.umpire1Email, mapping.umpire2Email, mapping.umpire3Email]
                      .filter(Boolean)
                      .map(col => row[col!] ?? '')
                      .filter(Boolean);

                    return (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className={cn('px-3 py-2 whitespace-nowrap', !dateOk && 'text-destructive')}>
                          {dateVal || <span className="text-muted-foreground">—</span>}
                          {!dateOk && ' ⚠'}
                        </td>
                        <td className={cn('px-3 py-2 whitespace-nowrap', !dateOk && 'text-destructive')}>
                          {timeVal || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2">{(mapping.homeTeam ? row[mapping.homeTeam] : '') || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2">{(mapping.awayTeam ? row[mapping.awayTeam] : '') || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2 text-muted-foreground">{loc || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{umpires.join(', ') || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(mapping.level ? row[mapping.level] : '') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <ul className="space-y-0.5">
                {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={validationErrors.length > 0 || submitting}
              className="flex-1"
            >
              {submitting ? 'Importing…' : `Import ${csvRows.length} game${csvRows.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </>
      )}

      {/* ── Step: Done ────────────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-400 shrink-0" />
            <div>
              <p className="font-semibold">
                {result.created} game{result.created !== 1 ? 's' : ''} created
                {result.skipped > 0 && <span className="text-muted-foreground font-normal">, {result.skipped} skipped</span>}
              </p>
              {result.warnings.length > 0 && (
                <p className="text-xs text-muted-foreground">{result.warnings.length} warning(s)</p>
              )}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border text-sm font-medium">Warnings</div>
              <div className="divide-y divide-border">
                {result.warnings.map((w, i) => (
                  <p key={i} className="px-4 py-2 text-xs text-muted-foreground">{w}</p>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" onClick={reset}>Import another file</Button>
        </div>
      )}
    </div>
  );
}
