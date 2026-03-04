import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, AlertTriangle, Users,
  Upload, Bell, ClipboardList, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Nav config ───────────────────────────────────────────────────────────────

interface NavItem { label: string; path: string; icon: React.ElementType }

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard',     path: '/admin',               icon: LayoutDashboard },
  { label: 'Games',         path: '/admin/games',         icon: CalendarDays },
  { label: 'Incidents',     path: '/admin/incidents',     icon: AlertTriangle },
  { label: 'Users',         path: '/admin/users',         icon: Users },
  { label: 'Import',        path: '/admin/import',        icon: Upload },
  { label: 'Notifications', path: '/admin/notifications', icon: Bell },
];

const UMPIRE_NAV: NavItem[] = [
  { label: 'Dashboard',      path: '/umpire',             icon: LayoutDashboard },
  { label: 'My Games',       path: '/umpire/games',       icon: CalendarDays },
  { label: 'My Submissions', path: '/umpire/submissions', icon: ClipboardList },
];

const MANAGER_NAV: NavItem[] = [
  { label: 'Dashboard',      path: '/manager',             icon: LayoutDashboard },
  { label: 'My Games',       path: '/manager/games',       icon: CalendarDays },
  { label: 'My Submissions', path: '/manager/submissions', icon: ClipboardList },
];

function getNav(orgRole: string | null): NavItem[] {
  if (orgRole === 'ADMIN')                    return ADMIN_NAV;
  if (orgRole === 'UMPIRE')                   return UMPIRE_NAV;
  if (orgRole === 'MANAGER' || orgRole === 'COACH') return MANAGER_NAV;
  return [];
}

// A nav item is "active" if the path matches exactly (for root dashboard paths)
// or if the current path starts with it (for section pages).
const DASHBOARD_PATHS = new Set(['/admin', '/umpire', '/manager']);
function isActive(navPath: string, current: string): boolean {
  if (DASHBOARD_PATHS.has(navPath)) return current === navPath;
  return current.startsWith(navPath);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onProfileOpen: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, onProfileOpen }: SidebarProps) {
  const { orgRole, user } = useAuth();
  const { pathname } = useLocation();
  const nav = getNav(orgRole);

  const inner = (
    <div
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center h-14 px-4 border-b border-sidebar-border shrink-0', collapsed && 'justify-center px-0')}>
        {collapsed ? (
          <span className="text-sidebar-primary font-bold text-lg">B</span>
        ) : (
          <span className="text-sidebar-foreground font-bold text-lg tracking-tight">Bluelyticsdash</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {nav.map((item) => {
          const active = isActive(item.path, pathname);
          const Icon = item.icon;

          const link = (
            <NavLink
              to={item.path}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 px-3 mx-2 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                collapsed && 'justify-center px-0 mx-2',
              )}
            >
              <Icon className="shrink-0 h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.path}>{link}</div>;
        })}
      </nav>

      {/* Footer: user + collapse toggle */}
      <div className="shrink-0 border-t border-sidebar-border">
        {/* User info */}
        {!collapsed && user && (
          <button
            onClick={onProfileOpen}
            className="w-full text-left px-4 py-3 hover:bg-sidebar-accent transition-colors"
          >
            <p className="text-xs text-sidebar-foreground font-medium truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
          </button>
        )}
        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggle}
          className="hidden md:flex w-full items-center justify-center h-10 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen sticky top-0 shrink-0">
        {inner}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="relative z-50 h-full w-60 animate-in slide-in-from-left-full duration-200">
            <div className="h-full">
              {/* Close button */}
              <button
                onClick={onMobileClose}
                className="absolute top-3 right-3 z-10 p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              {/* Reuse inner but always expanded */}
              <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border w-60">
                <div className="flex items-center h-14 px-4 border-b border-sidebar-border shrink-0">
                  <span className="text-sidebar-foreground font-bold text-lg tracking-tight">Bluelyticsdash</span>
                </div>
                <nav className="flex-1 py-3 overflow-y-auto">
                  {nav.map((item) => {
                    const active = isActive(item.path, pathname);
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onMobileClose}
                        className={cn(
                          'flex items-center gap-3 px-3 mx-2 py-2 rounded-md text-sm font-medium transition-colors',
                          active
                            ? 'bg-sidebar-accent text-sidebar-primary'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        )}
                      >
                        <Icon className="shrink-0 h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
                {user && (
                  <button
                    onClick={() => { onMobileClose(); onProfileOpen(); }}
                    className="shrink-0 w-full text-left border-t border-sidebar-border px-4 py-3 hover:bg-sidebar-accent transition-colors"
                  >
                    <p className="text-xs text-sidebar-foreground font-medium truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
