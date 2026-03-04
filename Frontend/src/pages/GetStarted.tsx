import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function GetStarted() {
  const { joinOrg, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // ── Create org ────────────────────────────────────────────────────────────
  const [orgName,    setOrgName]    = useState('');
  const [creating,   setCreating]   = useState(false);
  const [createError, setCreateError] = useState('');

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await api.post('/orgs', { name: orgName.trim() });
      await refreshUser();
      navigate('/admin');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create organization.');
    } finally {
      setCreating(false);
    }
  }

  // ── Join org ──────────────────────────────────────────────────────────────
  const [code,      setCode]      = useState('');
  const [joining,   setJoining]   = useState(false);
  const [joinError, setJoinError] = useState('');

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setJoinError('');
    setJoining(true);
    try {
      await joinOrg(code.trim());
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setJoinError(msg ?? 'Invalid or expired invite code.');
    } finally {
      setJoining(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Bluelyticsdash</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            You're not part of any organization yet. Create one or join an existing one to get started.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Create org */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Create an organization</CardTitle>
              <CardDescription>Start fresh and invite your team.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input
                    id="orgName"
                    placeholder="e.g. Metro Baseball League"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    required
                  />
                </div>
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <Button type="submit" className="w-full" disabled={creating || !orgName.trim()}>
                  {creating ? 'Creating…' : 'Create organization'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Divider — mobile only */}
          <div className="relative flex items-center md:hidden">
            <div className="flex-1 border-t border-border" />
            <span className="px-3 text-xs text-muted-foreground uppercase tracking-wide">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Join org */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Join an organization</CardTitle>
              <CardDescription>Enter an invite code shared by your admin.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Invite code</Label>
                  <Input
                    id="code"
                    placeholder="e.g. metro-baseball-a3f2"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>
                {joinError && <p className="text-sm text-destructive">{joinError}</p>}
                <Button type="submit" className="w-full" disabled={joining || !code.trim()}>
                  {joining ? 'Joining…' : 'Join organization'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sign out */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Wrong account?{' '}
          <button
            type="button"
            onClick={handleLogout}
            className="text-primary hover:underline underline-offset-4"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
