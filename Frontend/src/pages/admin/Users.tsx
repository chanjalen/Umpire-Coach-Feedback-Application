import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { OrgMember, OrgInvite, MemberRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Trash2, Link, Copy, CheckCheck } from 'lucide-react';

const ROLE_BADGE: Record<MemberRole, string> = {
  ADMIN:   'bg-primary/20 text-primary border-primary/30',
  UMPIRE:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  MANAGER: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  COACH:   'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

interface OrgDetail {
  id: string;
  name: string;
  members: OrgMember[];
}

export default function AdminUsers() {
  const { orgId, user: me } = useAuth();
  const navigate = useNavigate();

  const [org, setOrg]           = useState<OrgDetail | null>(null);
  const [invites, setInvites]   = useState<OrgInvite[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Add member dialog (sends invite email)
  const [addOpen, setAddOpen]   = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole]   = useState<'ADMIN' | 'UMPIRE' | 'MANAGER'>('UMPIRE');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen]   = useState(false);
  const [inviteRole, setInviteRole]   = useState<'UMPIRE' | 'MANAGER'>('UMPIRE');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function load() {
    if (!orgId) return;
    setLoading(true);
    Promise.all([
      api.get<OrgDetail>(`/orgs/${orgId}`),
      api.get<OrgInvite[]>(`/orgs/${orgId}/invites`),
    ])
      .then(([orgRes, inviteRes]) => {
        setOrg(orgRes.data);
        setInvites(inviteRes.data);
      })
      .catch(() => setError('Failed to load members.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orgId]);

  async function handleSendInvite() {
    if (!orgId) return;
    setAddError('');
    setAddLoading(true);
    try {
      await api.post(`/orgs/${orgId}/invites`, { email: addEmail, role: addRole });
      setAddSuccess(true);
      setAddEmail('');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg ?? 'Failed to send invite.');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRoleChange(userId: string, role: MemberRole) {
    if (!orgId) return;
    await api.patch(`/orgs/${orgId}/members/${userId}`, { role }).catch(() => null);
    load();
  }

  async function handleRemove(userId: string) {
    if (!orgId) return;
    if (!confirm('Remove this member from the organization?')) return;
    await api.delete(`/orgs/${orgId}/members/${userId}`).catch(() => null);
    load();
  }

  async function handleCreateInvite() {
    if (!orgId) return;
    setInviteLoading(true);
    try {
      await api.post(`/orgs/${orgId}/invites`, { role: inviteRole });
      setInviteOpen(false);
      const res = await api.get<OrgInvite[]>(`/orgs/${orgId}/invites`);
      setInvites(res.data);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!orgId) return;
    await api.delete(`/orgs/${orgId}/invites/${inviteId}`).catch(() => null);
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  }

  function copyCode(invite: OrgInvite) {
    navigator.clipboard.writeText(invite.code);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  const members = org?.members ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground text-sm mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add member
        </Button>
      </div>

      {/* Members table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Role</th>
              <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Joined</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map(m => (
              <tr
                key={m.id}
                className="hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/members/${m.userId}`)}
              >
                <td className="px-4 py-3 font-medium">
                  {m.user.firstName} {m.user.lastName}
                  {m.userId === me?.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{m.user.email}</td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  {m.userId === me?.id ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[m.role]}`}>
                      {m.role}
                    </span>
                  ) : (
                    <Select
                      value={m.role}
                      onValueChange={v => handleRoleChange(m.userId, v as MemberRole)}
                    >
                      <SelectTrigger className="h-7 text-xs w-28 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="UMPIRE">Umpire</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                  {formatDate(m.joinedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.userId !== me?.id && (
                    <button
                      onClick={e => { e.stopPropagation(); handleRemove(m.userId); }}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Separator />

      {/* Invite codes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Invite codes</h2>
            <p className="text-muted-foreground text-sm">Share a code so users can join the org.</p>
          </div>
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            <Link className="h-4 w-4 mr-2" />
            Create invite
          </Button>
        </div>

        {invites.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active invite codes.</p>
        ) : (
          <div className="space-y-2">
            {invites.map(inv => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <code className="text-sm font-mono text-foreground truncate">{inv.code}</code>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[inv.role as MemberRole] ?? ''}`}>
                    {inv.role}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyCode(inv)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy code"
                  >
                    {copiedId === inv.id ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Revoke invite"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add member dialog (sends invite email) */}
      <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) { setAddError(''); setAddSuccess(false); setAddEmail(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
          </DialogHeader>
          {addSuccess ? (
            <div className="py-4 space-y-3 text-center">
              <p className="text-sm font-medium text-green-400">Invite sent!</p>
              <p className="text-sm text-muted-foreground">They'll receive an email with a link to join the organization.</p>
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => { setAddSuccess(false); }}>Send another</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Email address</Label>
                  <Input
                    type="email"
                    placeholder="member@example.com"
                    value={addEmail}
                    onChange={e => setAddEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={addRole} onValueChange={v => setAddRole(v as 'ADMIN' | 'UMPIRE' | 'MANAGER')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="UMPIRE">Umpire</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {addError && <p className="text-sm text-destructive">{addError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAddOpen(false); setAddError(''); }}>Cancel</Button>
                <Button onClick={handleSendInvite} disabled={addLoading || !addEmail}>
                  {addLoading ? 'Sending…' : 'Send invite'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create invite code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role for invitees</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as 'UMPIRE' | 'MANAGER')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UMPIRE">Umpire</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateInvite} disabled={inviteLoading}>
              {inviteLoading ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
