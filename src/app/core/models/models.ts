// ─── Auth ──────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

// ─── Donation Categories ────────────────────────────────────────────
export interface DonationCategory {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  totalAmount: number;
  isDeleted?: boolean;
}

// ─── Donation ───────────────────────────────────────────────────────
export interface AddDonationRequest {
  categoryId: string;
  amount: number;
  targetUserId?: string;
  notes?: string;
  targetCategoryId?: string;
}

export interface MyDonation {
  id: string;
  amount: number;
  createdAt: string;
  category: { id: string; name: string };
  notes?: string;
}

// ─── Members ────────────────────────────────────────────────────────
export interface AssociationMember {
  id: string;
  fullName: string;
  phoneNumber: string;
  role?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MemberDto {
  fullName: string;
  phoneNumber: string;
  role?: string;
  address?: string;
}

// ─── Partner Charities ──────────────────────────────────────────────
export interface PartnerCharity {
  id: string;
  name: string;
  contactPerson?: string;
  phoneNumber?: string;
  logoUrl?: string;
  address?: string;
}

export interface PartnerCharityDto {
  name: string;
  contactPerson?: string;
  phoneNumber?: string;
  logoUrl?: string;
  address?: string;
}

// ─── Investigation Cases ────────────────────────────────────────────
export type CaseStatus = 'Pending' | 'UnderInvestigation' | 'Approved' | 'Rejected' | 'Closed';

export interface InvestigationCase {
  id: string;
  fullName: string;
  nationalId: string;
  familyMembersCount: number;
  phoneNumber?: string;
  address?: string;
  caseDetails?: string;
  eligibility?: string;
  requiredSupport?: string;
  region?: string;
  husbandName?: string;
  husbandJob?: string;
  childrenDetails?: string;
  incomeSource?: string;
  images?: string[];
  status: CaseStatus;
  createdAt: string;
  createdByUserId?: string;
  createdByUserName?: string;
}

export interface CaseDto {
  fullName: string;
  nationalId: string;
  familyMembersCount: number;
  phoneNumber?: string;
  address?: string;
  caseDetails?: string;
  eligibility?: string;
  requiredSupport?: string;
  region?: string;
  husbandName?: string;
  husbandJob?: string;
  childrenDetails?: string;
  incomeSource?: string;
}

// ─── Dashboard ──────────────────────────────────────────────────────
export interface DashboardStats {
  totalDonations: number;
  donationsCount: number;
  membersCount: number;
  partnersCount: number;
  casesCount: number;
  pendingCases: number;
  approvedCases: number;
  rejectedCases: number;
  categoryTotals: { id: string; name: string; totalAmount: number; imageUrl: string }[];
  personalCategoryTotals: { id: string; name: string; totalAmount: number; imageUrl: string }[];
  personalLiquidity: number;
  personalBreakdown?: { categoryName: string; amount: number }[];
  personalLiquidityAllocations?: {
    userId: string;
    fullName: string;
    totalAmount: number;
    breakdown: { categoryName: string; amount: number }[]
  }[];
  myTransfers?: { id: string; amount: number; notes?: string; createdAt: string; fromUserName: string; toUserName: string; fromUserId: string; toUserId: string }[];
  volunteersCount?: number;
  usersCount?: number;
  operationsCount?: number;
  guidesCount?: number;
  transportationsCount?: number;
}

export interface RecentDonation {
  id: string;
  amount: number;
  createdAt: string;
  donorName: string;
  donorEmail: string;
  categoryName: string;
}

export interface LiquidityUser {
  userId: string;
  fullName: string;
  totalAmount: number;
  breakdown: { categoryName: string; amount: number }[];
}

// ─── Guides & Transportations ───────────────────────────────────────
export interface Guide {
  id: string;
  name: string;
  phoneNumber: string;
  location?: string;
}
export interface GuideDto {
  name: string;
  phoneNumber: string;
  location?: string;
}

export interface Transportation {
  id: string;
  name: string;
  phoneNumber: string;
}
export interface TransportationDto {
  name: string;
  phoneNumber: string;
}
