import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local[0] ?? '';
  return `${visible}${'*'.repeat(Math.min(5, Math.max(0, local.length - 1)))}@${domain}`;
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token');

  // Email passed from the registration page via router state
  const stateEmail: string = (location.state as { email?: string } | null)?.email ?? '';

  // ── Token flow (arrived from email link) ──────────────────────────────────
  const [verifyStatus, setVerifyStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) return;
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setVerifyStatus('success'))
      .catch(() => setVerifyStatus('error'));
  }, [token]);

  // ── Resend flow ───────────────────────────────────────────────────────────
  const [manualEmail, setManualEmail] = useState('');
  const [sent,        setSent]        = useState(false);
  const [sending,     setSending]     = useState(false);

  // Use the email from router state if available, otherwise the manually typed one
  const activeEmail = stateEmail || manualEmail;

  async function handleResend(e?: FormEvent) {
    e?.preventDefault();
    if (!activeEmail) return;
    setSending(true);
    try {
      await api.post('/auth/resend-verification', { email: activeEmail });
    } finally {
      setSending(false);
      setSent(true);
    }
  }

  // ── Render: token present ─────────────────────────────────────────────────
  if (token) {
    if (verifyStatus === 'loading') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <p className="text-muted-foreground text-sm animate-pulse">Verifying your email…</p>
        </div>
      );
    }

    if (verifyStatus === 'success') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <Card className="w-full max-w-sm text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">Email verified!</CardTitle>
              <CardDescription>Your account is now active. You can sign in.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/login">
                <Button className="w-full">Go to sign in</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    // error state — link expired or invalid
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">Link expired</CardTitle>
            <CardDescription>
              This verification link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResendSection
              knownEmail={stateEmail}
              manualEmail={manualEmail}
              setManualEmail={setManualEmail}
              sent={sent}
              sending={sending}
              onResend={handleResend}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: no token — "check your email" ────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to your inbox. Click it to activate your account.
            The link expires in 72 hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResendSection
            knownEmail={stateEmail}
            manualEmail={manualEmail}
            setManualEmail={setManualEmail}
            sent={sent}
            sending={sending}
            onResend={handleResend}
          />
          <p className="text-center text-sm text-muted-foreground">
            Already verified?{' '}
            <Link to="/login" className="text-primary hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Resend section ─────────────────────────────────────────────────────────

function ResendSection({
  knownEmail,
  manualEmail,
  setManualEmail,
  sent,
  sending,
  onResend,
}: {
  knownEmail: string;
  manualEmail: string;
  setManualEmail: (v: string) => void;
  sent: boolean;
  sending: boolean;
  onResend: (e?: FormEvent) => void;
}) {
  if (sent) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-400">
          If that email is registered and unverified, a new link is on its way.
        </p>
        <Link to="/login">
          <Button variant="outline" className="w-full">Back to sign in</Button>
        </Link>
      </div>
    );
  }

  // Email is known from registration — show masked address + one-click resend
  if (knownEmail) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Didn't get it? Resend to{' '}
          <span className="text-foreground font-medium">{maskEmail(knownEmail)}</span>
        </p>
        <Button className="w-full" disabled={sending} onClick={() => onResend()}>
          {sending ? 'Sending…' : 'Resend verification email'}
        </Button>
      </div>
    );
  }

  // Fallback — user navigated here directly without going through registration
  return (
    <form onSubmit={onResend} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="resend-email">Email address</Label>
        <Input
          id="resend-email"
          type="email"
          placeholder="you@example.com"
          value={manualEmail}
          onChange={e => setManualEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={sending || !manualEmail}>
        {sending ? 'Sending…' : 'Resend verification email'}
      </Button>
    </form>
  );
}
