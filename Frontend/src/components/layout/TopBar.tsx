import { Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface TopBarProps {
  onMenuClick: () => void;
  onProfileOpen: () => void;
}

export default function TopBar({ onMenuClick, onProfileOpen }: TopBarProps) {
  const { user, orgId, orgRole } = useAuth();

  // Derive a display label for the active org
  const orgName = user?.orgMemberships?.find(m => m.orgId === orgId)?.org.name ?? 'Bluelyticsdash';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Org name */}
      <span className="hidden md:block text-sm font-semibold text-foreground truncate">
        {orgName}
      </span>

      {/* Mobile title */}
      <span className="md:hidden text-sm font-semibold text-foreground">Bluelyticsdash</span>

      <div className="flex-1" />

      {/* Right side: role badge + clickable user name */}
      <div className="flex items-center gap-3">
        {orgRole && (
          <span className="hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
            {orgRole.toLowerCase()}
          </span>
        )}

        {user && (
          <button
            onClick={onProfileOpen}
            className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {user.firstName} {user.lastName}
          </button>
        )}
      </div>
    </header>
  );
}
