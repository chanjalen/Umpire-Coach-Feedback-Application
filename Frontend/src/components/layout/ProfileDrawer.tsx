import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { MemberRole } from '@/types';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { X, LogOut, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// ─── Role badge colours ────────────────────────────────────────────────────────

const ROLE_BADGE: Record<MemberRole, string> = {
  ADMIN:   'bg-primary/20 text-primary border-primary/30',
  UMPIRE:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  MANAGER: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  COACH:   'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

const ROLE_HOME: Record<MemberRole, string> = {
  ADMIN:   '/admin',
  UMPIRE:  '/umpire',
  MANAGER: '/manager',
  COACH:   '/manager',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { user, orgId, allOrgs, switchOrg, joinOrg, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Profile edit ──
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError,   setProfileError]   = useState('');

  // ── Password ──
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwSuccess,  setPwSuccess]  = useState(false);
  const [pwError,    setPwError]    = useState('');

  // ── Leave org confirm ──
  const [leavingOrgId, setLeavingOrgId] = useState<string | null>(null);

  // ── Add org (create or join) ──
  const [addOrgMode,   setAddOrgMode]   = useState<'create' | 'join' | null>(null);
  const [addOrgName,   setAddOrgName]   = useState('');
  const [addOrgCode,   setAddOrgCode]   = useState('');
  const [addOrgSaving, setAddOrgSaving] = useState(false);
  const [addOrgError,  setAddOrgError]  = useState('');

  // Sync name fields when drawer opens or user changes
  useEffect(() => {
    if (open && user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setProfileSuccess(false);
      setProfileError('');
      setPwSuccess(false);
      setPwError('');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setLeavingOrgId(null);
      setAddOrgMode(null);
      setAddOrgName('');
      setAddOrgCode('');
      setAddOrgError('');
    }
  }, [open, user]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ── Handlers ──

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess(false);
    try {
      await api.patch('/users/me', { firstName, lastName });
      await refreshUser();
      setProfileSuccess(true);
    } catch {
      setProfileError('Failed to save. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    setPwError('');
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    try {
      await api.patch('/users/me/password', { currentPassword: currentPw, newPassword: newPw });
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPwError(msg ?? 'Failed to update password.');
    } finally {
      setPwSaving(false);
    }
  }

  async function handleLeaveOrg(leaveOrgId: string) {
    try {
      await api.delete(`/users/me/orgs/${leaveOrgId}`);
      await refreshUser();
      setLeavingOrgId(null);
      // If we just left the active org, navigate to / so RoleRedirect picks a new one
      if (leaveOrgId === orgId) {
        onClose();
        navigate('/', { replace: true });
      }
    } catch {
      // non-fatal — just close confirm
      setLeavingOrgId(null);
    }
  }

  function handleOrgClick(membership: typeof allOrgs[0]) {
    const role = switchOrg(membership.orgId);
    if (!role) return;
    onClose();
    navigate(ROLE_HOME[role as MemberRole] ?? '/');
  }

  async function handleAddOrg() {
    setAddOrgError('');
    setAddOrgSaving(true);
    try {
      if (addOrgMode === 'create') {
        await api.post('/orgs', { name: addOrgName.trim() });
      } else {
        await joinOrg(addOrgCode.trim());
      }
      await refreshUser();
      setAddOrgMode(null);
      setAddOrgName('');
      setAddOrgCode('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAddOrgError(msg ?? (addOrgMode === 'create' ? 'Failed to create organization.' : 'Invalid or expired invite code.'));
    } finally {
      setAddOrgSaving(false);
    }
  }

  function handleLogout() {
    logout();
    onClose();
    navigate('/login', { replace: true });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-card border-l border-border shadow-xl flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-base">My Profile</h2>
            {user && <p className="text-xs text-muted-foreground">{user.email}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── Organizations ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Organizations</h3>
              <button
                onClick={() => {
                  setAddOrgMode(m => m ? null : 'create');
                  setAddOrgError('');
                  setAddOrgName('');
                  setAddOrgCode('');
                }}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  addOrgMode
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                aria-label="Add organization"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Inline add-org form */}
            {addOrgMode && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                {/* Mode switcher */}
                <div className="flex gap-1 text-xs">
                  <button
                    onClick={() => { setAddOrgMode('create'); setAddOrgError(''); }}
                    className={cn(
                      'px-2.5 py-1 rounded-md font-medium transition-colors',
                      addOrgMode === 'create'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Create new
                  </button>
                  <button
                    onClick={() => { setAddOrgMode('join'); setAddOrgError(''); }}
                    className={cn(
                      'px-2.5 py-1 rounded-md font-medium transition-colors',
                      addOrgMode === 'join'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Join with code
                  </button>
                </div>

                {addOrgMode === 'create' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Organization name</Label>
                    <Input
                      placeholder="e.g. Metro Baseball League"
                      value={addOrgName}
                      onChange={e => setAddOrgName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addOrgName.trim() && handleAddOrg()}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invite code</Label>
                    <Input
                      placeholder="e.g. metro-baseball-a3f2"
                      value={addOrgCode}
                      onChange={e => setAddOrgCode(e.target.value)}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      onKeyDown={e => e.key === 'Enter' && addOrgCode.trim() && handleAddOrg()}
                    />
                  </div>
                )}

                {addOrgError && <p className="text-xs text-destructive">{addOrgError}</p>}

                <Button
                  size="sm"
                  className="w-full"
                  disabled={addOrgSaving || (addOrgMode === 'create' ? !addOrgName.trim() : !addOrgCode.trim())}
                  onClick={handleAddOrg}
                >
                  {addOrgSaving
                    ? (addOrgMode === 'create' ? 'Creating…' : 'Joining…')
                    : (addOrgMode === 'create' ? 'Create organization' : 'Join organization')}
                </Button>
              </div>
            )}

            {allOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">You're not a member of any org yet.</p>
            ) : (
              <div className="space-y-2">
                {allOrgs.map(m => {
                  const isActive = m.orgId === orgId;
                  const isConfirmingLeave = leavingOrgId === m.orgId;
                  return (
                    <div
                      key={m.orgId}
                      className={cn(
                        'rounded-lg border bg-muted/20 overflow-hidden',
                        isActive ? 'border-primary/40' : 'border-border',
                      )}
                    >
                      {/* Clickable card body */}
                      <button
                        onClick={() => handleOrgClick(m)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{m.org.name}</p>
                              {isActive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium shrink-0">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Joined {formatDate(m.joinedAt)}
                            </p>
                          </div>
                          <span className={cn(
                            'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                            ROLE_BADGE[m.role as MemberRole],
                          )}>
                            {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                          </span>
                        </div>
                      </button>

                      {/* Leave action */}
                      <div className="px-4 pb-3">
                        {isConfirmingLeave ? (
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground flex-1">Leave this org?</p>
                            <button
                              onClick={() => handleLeaveOrg(m.orgId)}
                              className="text-xs text-destructive hover:underline font-medium"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setLeavingOrgId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setLeavingOrgId(m.orgId)}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Leave org
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* ── Edit Profile ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Edit Profile</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First name</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last name</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>
            {profileError   && <p className="text-xs text-destructive">{profileError}</p>}
            {profileSuccess && <p className="text-xs text-green-400">Name updated!</p>}
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={profileSaving || !firstName || !lastName}
              className="w-full"
            >
              {profileSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </section>

          <Separator />

          {/* ── Change Password ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Current password</Label>
                <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New password</Label>
                <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm new password</Label>
                <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
              </div>
            </div>
            {pwError   && <p className="text-xs text-destructive">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-green-400">Password updated!</p>}
            <Button
              size="sm"
              onClick={handleChangePassword}
              disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="w-full"
            >
              {pwSaving ? 'Updating…' : 'Update password'}
            </Button>
          </section>

        </div>

        {/* Footer — Log out */}
        <div className="shrink-0 border-t border-border px-5 py-4">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
        </div>
      </div>
    </>
  );
}
