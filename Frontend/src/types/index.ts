// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'UMPIRE' | 'COACH' | 'MANAGER';
export type MemberRole = 'ADMIN' | 'UMPIRE' | 'COACH' | 'MANAGER';

export interface OrgMembership {
  id: string;
  orgId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  org: Org;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  orgMemberships?: OrgMembership[];
}

export interface AuthTokens {
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  orgName?: string;
  role?: UserRole;
}

// ─── Org ──────────────────────────────────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: string;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user: User;
}

export interface OrgInvite {
  id: string;
  orgId: string;
  code: string;
  role: MemberRole;
  isActive: boolean;
  createdAt: string;
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export type GameStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Game {
  id: string;
  orgId: string;
  title: string;
  homeTeam?: string;
  awayTeam?: string;
  location?: string;
  scheduledAt: string;
  sport: string;
  level?: string;
  status: GameStatus;
  hasIncident: boolean;
  notes?: string;
  createdAt: string;
  umpires?: GameUmpire[];
  managers?: GameManager[];
}

export interface GameUmpire {
  id: string;
  gameId: string;
  userId: string;
  position: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatarUrl'>;
}

export interface GameManager {
  id: string;
  gameId: string;
  userId: string;
  team: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatarUrl'>;
}

// ─── Submission ───────────────────────────────────────────────────────────────

export type SubmissionStatus = 'PENDING' | 'SUBMITTED';

export interface Submission {
  id: string;
  gameId: string;
  createdBy: string;
  status: SubmissionStatus;
  dueAt?: string;
  closedAt?: string;
  createdAt: string;
  game?: Game;
  _count?: { coachRatings: number; umpireRatings: number };
}

export interface CoachUmpireRating {
  id: string;
  submissionId: string;
  coachId: string;
  umpireId: string;
  noShow: boolean;
  appearance?: number | null;
  judgment?: number | null;
  mechanics?: number | null;
  gameControl?: number | null;
  composure?: number | null;
  attitude?: number | null;
  comments?: string | null;
  submittedAt: string;
}

export interface UmpireManagerRating {
  id: string;
  submissionId: string;
  umpireId: string;
  managerId: string;
  noShow: boolean;
  sportsmanship?: number | null;
  cooperation?: number | null;
  comments?: string | null;
  submittedAt: string;
}

// ─── Incident ─────────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  orgId: string;
  reportedBy: string;
  subjectId: string;
  gameId?: string;
  title: string;
  description: string;
  resolvedAt?: string;
  createdAt: string;
  reporter?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  subject?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  game?: Pick<Game, 'id' | 'title' | 'scheduledAt'>;
}

// ─── Email notifications ──────────────────────────────────────────────────────

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface EmailNotification {
  id: string;
  userId: string;
  type?: string;
  relatedId?: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  sentAt?: string;
  error?: string;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  issues?: unknown[];
}
