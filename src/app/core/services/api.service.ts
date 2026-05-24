import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest, RegisterRequest, AuthResponse,
  DonationCategory, AddDonationRequest, MyDonation, LiquidityUser
} from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ─── Auth ──────────────────────────────────────────────────────────
  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/login`, data);
  }

  register(data: RegisterRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/auth/register`, data);
  }

  // ─── Donation Categories ────────────────────────────────────────────
  getCategories(): Observable<DonationCategory[]> {
    return this.http.get<DonationCategory[]>(`${this.api}/donations/categories`);
  }

  addCategory(data: any): Observable<DonationCategory> {
    return this.http.post<DonationCategory>(`${this.api}/categories`, data);
  }

  updateCategory(id: string, data: any): Observable<DonationCategory> {
    return this.http.put<DonationCategory>(`${this.api}/categories/${id}`, data);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete<any>(`${this.api}/categories/${id}`);
  }

  getCategory(id: string): Observable<DonationCategory> {
    return this.http.get<DonationCategory>(`${this.api}/donations/categories/${id}`);
  }

  // ─── Donations ──────────────────────────────────────────────────────
  addDonation(data: AddDonationRequest): Observable<{ message: string; newTotal: number }> {
    return this.http.post<{ message: string; newTotal: number }>(`${this.api}/donations`, data);
  }

  addDeduction(data: { amount: number; targetUserId?: string; notes?: string; categoryId?: string }): Observable<{ message: string; newPersonalLiquidity: number }> {
    return this.http.post<{ message: string; newPersonalLiquidity: number }>(`${this.api}/donations/deduct`, data);
  }

  updateDonation(id: string, data: AddDonationRequest): Observable<{ message: string; newTotal: number }> {
    return this.http.put<{ message: string; newTotal: number }>(`${this.api}/donations/${id}`, data);
  }

  deleteDonation(id: string): Observable<{ message: string; newTotal: number }> {
    return this.http.delete<{ message: string; newTotal: number }>(`${this.api}/donations/${id}`);
  }

  getMyDonations(): Observable<MyDonation[]> {
    return this.http.get<MyDonation[]>(`${this.api}/donations/my`);
  }

  // ─── Dashboard ──────────────────────────────────────────────────────
  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.api}/dashboard/stats`);
  }

  getUserStats(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/user-stats/${userId}`);
  }


  getRecentDonations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/recent-donations`);
  }

  getGlobalHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/global-history`);
  }

  getAllDonations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/all-donations`);
  }

  getLiquidityReport(): Observable<LiquidityUser[]> {
    return this.http.get<LiquidityUser[]>(`${this.api}/dashboard/liquidity-report`);
  }

  // ─── Members ────────────────────────────────────────────────────────
  getMembers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/members`);
  }

  addMember(data: any): Observable<any> {
    return this.http.post(`${this.api}/members`, data);
  }

  updateMember(id: string, data: any): Observable<any> {
    return this.http.put(`${this.api}/members/${id}`, data);
  }

  deleteMember(id: string): Observable<any> {
    return this.http.delete(`${this.api}/members/${id}`);
  }

  // ─── Partner Charities ──────────────────────────────────────────────
  getPartners(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/partnercharities`);
  }

  addPartner(data: any): Observable<any> {
    return this.http.post(`${this.api}/partnercharities`, data);
  }

  updatePartner(id: string, data: any): Observable<any> {
    return this.http.put(`${this.api}/partnercharities/${id}`, data);
  }

  deletePartner(id: string): Observable<any> {
    return this.http.delete(`${this.api}/partnercharities/${id}`);
  }

  // ─── Investigation Cases ────────────────────────────────────────────
  getCases(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/cases`);
  }

  addCase(data: any): Observable<any> {
    return this.http.post(`${this.api}/cases`, data);
  }

  updateCase(id: string, data: any): Observable<any> {
    return this.http.put(`${this.api}/cases/${id}`, data);
  }

  updateCaseStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${this.api}/cases/${id}/status`, { status });
  }

  deleteCase(id: string): Observable<any> {
    return this.http.delete<any>(`${this.api}/cases/${id}`);
  }

  deleteAllCases(): Observable<any> {
    return this.http.delete<any>(`${this.api}/cases/all`);
  }

  // ─── Volunteers ─────────────────────────────────────────────────────
  getVolunteers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/volunteers`);
  }

  addVolunteer(data: any): Observable<any> {
    return this.http.post(`${this.api}/volunteers`, data);
  }

  updateVolunteer(id: string, data: any): Observable<any> {
    return this.http.put(`${this.api}/volunteers/${id}`, data);
  }

  deleteVolunteer(id: string): Observable<any> {
    return this.http.delete(`${this.api}/volunteers/${id}`);
  }

  // ─── Users Management ────────────────────────────────────────
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/users`);
  }

  changeUserRole(id: string, role: string): Observable<any> {
    return this.http.put<any>(`${this.api}/users/${id}/role`, { role });
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${this.api}/users/${id}`);
  }

  resetUserPassword(id: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.api}/users/${id}/reset-password`, { newPassword });
  }

  getFinancialAdmins(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/users/financial-admins`);
  }

  // ─── Guides ────────────────────────────────────────────────────────
  getGuides(): Observable<any[]> { return this.http.get<any[]>(`${this.api}/guides`); }
  addGuide(data: any): Observable<any> { return this.http.post(`${this.api}/guides`, data); }
  updateGuide(id: string, data: any): Observable<any> { return this.http.put(`${this.api}/guides/${id}`, data); }
  deleteGuide(id: string): Observable<any> { return this.http.delete(`${this.api}/guides/${id}`); }

  // ─── Transportations ────────────────────────────────────────────────
  getTransportations(): Observable<any[]> { return this.http.get<any[]>(`${this.api}/transportations`); }
  addTransportation(data: any): Observable<any> { return this.http.post(`${this.api}/transportations`, data); }
  updateTransportation(id: string, data: any): Observable<any> { return this.http.put(`${this.api}/transportations/${id}`, data); }
  deleteTransportation(id: string): Observable<any> { return this.http.delete(`${this.api}/transportations/${id}`); }

  // ─── Financial Transfers ────────────────────────────────────────────
  createFinancialTransfer(data: { fromUserId: string; toUserId: string; categoryId: string; amount: number; notes?: string }): Observable<any> {
    return this.http.post<any>(`${this.api}/financialtransfers`, data);
  }

  getMyFinancialTransfers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/financialtransfers/my`);
  }

  deleteFinancialTransfer(id: string): Observable<any> {
    return this.http.delete<any>(`${this.api}/financialtransfers/${id}`);
  }

  // ─── Pending Finances ──────────────────────────────────────────────
  getPendingDonations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/donations/pending`);
  }

  activatePendingDonation(id: string): Observable<any> {
    return this.http.post<any>(`${this.api}/donations/${id}/activate`, {});
  }
}
