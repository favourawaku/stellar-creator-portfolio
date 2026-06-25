// Admin service — mock data layer. Replace with real DB calls when backend is ready.

export type UserRole = 'ADMIN' | 'CLIENT' | 'CREATOR' | 'USER';
export type UserStatus = 'active' | 'suspended' | 'pending';
export type BountyStatus = 'open' | 'in-progress' | 'completed' | 'cancelled' | 'flagged';
export type ReportStatus = 'open' | 'resolved' | 'dismissed' | 'escalated' | 'removed';
export type AuditAction =
  | 'user.suspend' | 'user.activate' | 'user.delete' | 'user.role_change'
  | 'bounty.approve' | 'bounty.flag' | 'bounty.delete'
  | 'report.resolve' | 'report.dismiss' | 'report.remove' | 'report.escalate'
  | 'verification.approve' | 'verification.revoke'
  | 'db.backup' | 'db.restore_drill';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
  lastActive: string;
  bounties: number;
  reports: number;
}

export interface AdminBounty {
  id: string;
  title: string;
  postedBy: string;
  budget: number;
  status: BountyStatus;
  category: string;
  applicants: number;
  postedAt: string;
  flagReason?: string;
}

export interface ContentReport {
  id: string;
  type: 'bounty' | 'profile' | 'message' | 'portfolio';
  targetId: string;
  targetTitle: string;
  reason: string;
  reportedBy: string;
  /** Name or address of the creator who owns the content. */
  creatorName: string;
  /** Cumulative number of unique users who flagged this content. */
  flagCount: number;
  /**
   * Content with 3+ flags is auto-blurred pending admin review.
   * Admins see a warning badge so they can prioritise the queue.
   */
  isAutoBlurred: boolean;
  status: ReportStatus;
  createdAt: string;
  /** Set when admin escalates to the legal team. */
  escalateReason?: string;
  /** Set when admin removes the content and sends a creator notification. */
  removalReason?: string;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  adminName: string;
  targetId: string;
  targetLabel: string;
  timestamp: string;
  note?: string;
}

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalBounties: number;
  openBounties: number;
  totalRevenue: number;
  pendingReports: number;
  newUsersThisWeek: number;
  completedBountiesThisMonth: number;
}

// ── Mock data ──────────────────────────────────────────────────────────────────

export const mockStats: PlatformStats = {
  totalUsers: 1284,
  activeUsers: 847,
  totalBounties: 342,
  openBounties: 89,
  totalRevenue: 128400,
  pendingReports: 7,
  newUsersThisWeek: 43,
  completedBountiesThisMonth: 28,
};

export const mockUsers: AdminUser[] = [
  { id: 'u1', name: 'Alex Chen', email: 'alex@example.com', role: 'CREATOR', status: 'active', joinedAt: '2024-01-15', lastActive: '2026-03-24', bounties: 12, reports: 0 },
  { id: 'u2', name: 'Maya Patel', email: 'maya@example.com', role: 'CREATOR', status: 'active', joinedAt: '2024-02-03', lastActive: '2026-03-23', bounties: 8, reports: 0 },
  { id: 'u3', name: 'Jordan Maxwell', email: 'jordan@example.com', role: 'CREATOR', status: 'pending', joinedAt: '2026-03-20', lastActive: '2026-03-20', bounties: 0, reports: 0 },
  { id: 'u4', name: 'Sophia Rodriguez', email: 'sophia@example.com', role: 'CREATOR', status: 'active', joinedAt: '2024-03-10', lastActive: '2026-03-22', bounties: 5, reports: 1 },
  { id: 'u5', name: 'Marcus Webb', email: 'marcus@example.com', role: 'CLIENT', status: 'active', joinedAt: '2024-06-01', lastActive: '2026-03-25', bounties: 7, reports: 0 },
  { id: 'u6', name: 'Priya Singh', email: 'priya@example.com', role: 'CLIENT', status: 'suspended', joinedAt: '2024-08-14', lastActive: '2026-02-10', bounties: 2, reports: 3 },
  { id: 'u7', name: 'Tom Nguyen', email: 'tom@example.com', role: 'USER', status: 'active', joinedAt: '2025-01-05', lastActive: '2026-03-21', bounties: 0, reports: 0 },
];

export const mockBounties: AdminBounty[] = [
  { id: 'b1', title: 'Brand Identity for Web3 Startup', postedBy: 'Marcus Webb', budget: 3000, status: 'open', category: 'Brand Strategy', applicants: 12, postedAt: '2026-03-23' },
  { id: 'b2', title: 'Technical Documentation for API', postedBy: 'Marcus Webb', budget: 1500, status: 'open', category: 'Technical Writing', applicants: 8, postedAt: '2026-03-22' },
  { id: 'b3', title: 'Social Media Campaign Content', postedBy: 'Priya Singh', budget: 2500, status: 'flagged', category: 'Content Creation', applicants: 15, postedAt: '2026-03-18', flagReason: 'Suspicious payment terms reported by 2 users' },
  { id: 'b4', title: 'UX Research & Usability Testing', postedBy: 'Tom Nguyen', budget: 4000, status: 'in-progress', category: 'UX Research', applicants: 6, postedAt: '2026-03-10' },
  { id: 'b5', title: 'Logo Design for SaaS Product', postedBy: 'Marcus Webb', budget: 800, status: 'completed', category: 'Brand Strategy', applicants: 20, postedAt: '2026-02-15' },
];

export const mockReports: ContentReport[] = [
  {
    id: 'r1', type: 'bounty', targetId: 'b3',
    targetTitle: 'Social Media Campaign Content',
    reason: 'Suspicious payment terms — asking for work before payment',
    reportedBy: 'Alex Chen', creatorName: 'Priya Singh',
    flagCount: 5, isAutoBlurred: true,
    status: 'open', createdAt: '2026-03-20',
  },
  {
    id: 'r2', type: 'profile', targetId: 'u6',
    targetTitle: 'Priya Singh — Profile',
    reason: 'Fake portfolio samples, copied from other creators',
    reportedBy: 'Maya Patel', creatorName: 'Priya Singh',
    flagCount: 3, isAutoBlurred: true,
    status: 'open', createdAt: '2026-03-19',
  },
  {
    id: 'r3', type: 'message', targetId: 'msg-99',
    targetTitle: 'DM from Priya Singh',
    reason: 'Spam / unsolicited promotional messages',
    reportedBy: 'Jordan Maxwell', creatorName: 'Priya Singh',
    flagCount: 1, isAutoBlurred: false,
    status: 'open', createdAt: '2026-03-21',
  },
  {
    id: 'r4', type: 'bounty', targetId: 'b2',
    targetTitle: 'Technical Documentation for API',
    reason: 'Budget seems unrealistically low for scope',
    reportedBy: 'Sophia Rodriguez', creatorName: 'Marcus Webb',
    flagCount: 2, isAutoBlurred: false,
    status: 'resolved', createdAt: '2026-03-15',
  },
  {
    id: 'r5', type: 'portfolio', targetId: 'port-12',
    targetTitle: 'Brand Identity Portfolio Item',
    reason: 'NSFW imagery included in design samples',
    reportedBy: 'Tom Nguyen', creatorName: 'Alex Chen',
    flagCount: 4, isAutoBlurred: true,
    status: 'open', createdAt: '2026-03-24',
  },
];

export const mockAuditLogs: AuditLog[] = [
  { id: 'a1', action: 'user.suspend', adminName: 'Admin', targetId: 'u6', targetLabel: 'Priya Singh', timestamp: '2026-03-22T14:30:00Z', note: 'Multiple reports of fraudulent activity' },
  { id: 'a2', action: 'verification.approve', adminName: 'Admin', targetId: 'u1', targetLabel: 'Alex Chen', timestamp: '2026-03-15T10:00:00Z' },
  { id: 'a3', action: 'bounty.flag', adminName: 'Admin', targetId: 'b3', targetLabel: 'Social Media Campaign Content', timestamp: '2026-03-20T09:15:00Z', note: 'Flagged pending investigation' },
  { id: 'a4', action: 'verification.approve', adminName: 'Admin', targetId: 'u2', targetLabel: 'Maya Patel', timestamp: '2026-01-20T09:00:00Z' },
  { id: 'a5', action: 'report.resolve', adminName: 'Admin', targetId: 'r4', targetLabel: 'Budget report on API bounty', timestamp: '2026-03-16T11:00:00Z', note: 'Reviewed — budget is valid for scope' },
  { id: 'a6', action: 'db.backup', adminName: 'System', targetId: 'db-prod', targetLabel: 'PostgreSQL Production', timestamp: '2026-06-25T02:00:00Z', note: 'Daily WAL-G basebackup successfully completed' },
  { id: 'a7', action: 'db.restore_drill', adminName: 'System', targetId: 'db-test', targetLabel: 'PostgreSQL Restore Drill', timestamp: '2026-06-01T04:12:00Z', note: 'Monthly restore drill completed. Smoke tests passed (Duration: 245s, Size: 20.4GB)' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

export function addAuditLog(
  logs: AuditLog[],
  action: AuditAction,
  targetId: string,
  targetLabel: string,
  note?: string
): AuditLog[] {
  const entry: AuditLog = {
    id: `a${Date.now()}`,
    action,
    adminName: 'Admin',
    targetId,
    targetLabel,
    timestamp: new Date().toISOString(),
    note,
  };
  return [entry, ...logs];
}
