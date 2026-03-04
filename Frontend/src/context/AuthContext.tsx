import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, OrgMembership, MemberRole } from '../types';
import api from '../lib/api';

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** The active org ID. */
  orgId: string | null;
  /** The user's role within the active org. */
  orgRole: OrgMembership['role'] | null;
  /** All orgs the user belongs to. */
  allOrgs: OrgMembership[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  joinOrg: (code: string) => Promise<void>;
  logout: () => void;
  /** Switch the active org. Returns the role so the caller can navigate. */
  switchOrg: (orgId: string) => MemberRole | null;
  /** Re-fetch /auth/me (e.g. after updating profile). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]   = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [isLoading, setIsLoading] = useState(true);

  // Active org stored in localStorage so switching survives page refresh
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    () => localStorage.getItem('activeOrgId'),
  );

  useEffect(() => {
    if (!token) { setIsLoading(false); return; }

    api.get<User>('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('accessToken');
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  // When user data changes, make sure activeOrgId is valid
  useEffect(() => {
    if (!user) return;
    const memberships = user.orgMemberships ?? [];
    if (memberships.length === 0) return;
    const valid = memberships.some(m => m.orgId === activeOrgId);
    if (!valid) {
      // Fall back to first membership
      const first = memberships[0].orgId;
      setActiveOrgId(first);
      localStorage.setItem('activeOrgId', first);
    }
  }, [user]);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    const { token: t } = res.data;
    localStorage.setItem('accessToken', t);
    setToken(t);
    const meRes = await api.get<User>('/auth/me', { headers: { Authorization: `Bearer ${t}` } });
    setUser(meRes.data);
  }

  async function register(data: RegisterData) {
    // Backend no longer returns a token — user must verify email before logging in
    await api.post('/auth/register', data);
  }

  async function joinOrg(code: string) {
    await api.post('/orgs/join', { code });
    const res = await api.get<User>('/auth/me');
    setUser(res.data);
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('activeOrgId');
    setToken(null);
    setUser(null);
    setActiveOrgId(null);
  }

  function switchOrg(orgId: string): MemberRole | null {
    const membership = user?.orgMemberships?.find(m => m.orgId === orgId) ?? null;
    if (!membership) return null;
    setActiveOrgId(orgId);
    localStorage.setItem('activeOrgId', orgId);
    return membership.role;
  }

  const refreshUser = useCallback(async () => {
    const res = await api.get<User>('/auth/me');
    setUser(res.data);
  }, []);

  const allOrgs = user?.orgMemberships ?? [];

  // Derive active membership
  const activeMembership =
    allOrgs.find(m => m.orgId === activeOrgId) ?? allOrgs[0] ?? null;
  const orgId   = activeMembership?.orgId   ?? null;
  const orgRole = activeMembership?.role    ?? null;

  return (
    <AuthContext.Provider value={{
      user, token, orgId, orgRole, allOrgs,
      isLoading, isAuthenticated: !!user,
      login, register, joinOrg, logout, switchOrg, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
