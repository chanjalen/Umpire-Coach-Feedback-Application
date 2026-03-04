import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function JoinOrg() {
  const { joinOrg, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [code, setCode]         = useState(searchParams.get('code') ?? '');
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await joinOrg(code.trim());
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Invalid or expired invite code.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold tracking-tight">Join an organization</CardTitle>
          <CardDescription>Enter the invite code your administrator shared with you</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
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

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || !code.trim()}>
              {isLoading ? 'Joining…' : 'Join organization'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Wrong account?{' '}
            <button
              type="button"
              onClick={handleLogout}
              className="text-primary hover:underline underline-offset-4"
            >
              Sign out
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
