import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { AuthService } from '../../../core/services/auth.service';
import { LiquidityUser } from '../../../core/models/models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-global-liquidity',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="header-section">
        <h2 class="section-title">💰 السيولة العامة للمسؤولين</h2>
        <p class="section-desc">توزيع المبالغ المالية المتوفرة حالياً مع كل مسؤول مالي حسب التخصص</p>
      </div>

      @if (loading) {
        <div class="loader">جاري جلب بيانات السيولة...</div>
      } @else {
        <div class="liquidity-grid">
          @for (user of liquidityUsers; track user.userId) {
            <div class="liquidity-card" [class.expanded]="expandedUserId === user.userId" (click)="toggleDetails(user.userId)">
              <div class="card-header">
                <div class="user-avatar">{{ user.fullName[0] }}</div>
                <div class="user-info">
                  <div class="user-name">{{ user.fullName }}</div>
                  <div class="liquidity-amount">{{ formatCurrency(user.totalAmount) }}</div>
                </div>
                <div class="expand-icon">{{ expandedUserId === user.userId ? '▲' : '▼' }}</div>
              </div>
              
              @if (expandedUserId === user.userId) {
                <div class="liquidity-details">
                  <table class="mini-table">
                    <thead>
                      <tr>
                        <th>البند / المجال</th>
                        <th class="text-left">المبلغ المتاح</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of user.breakdown; track item.categoryName) {
                        <tr>
                          <td>{{ item.categoryName }}</td>
                          <td class="text-left font-bold" [class.text-danger]="item.amount < 0">{{ formatCurrency(item.amount) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        </div>

        @if (liquidityUsers.length === 0) {
          <div class="empty-state">📭 لا توجد سيولة مسجلة حالياً</div>
        }
      }
    </div>
  `,
  styles: [`
    .page-container { animation: fadeIn 0.4s ease-out; }
    .header-section { margin-bottom: 2rem; }
    .section-title { font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; }
    .section-desc { color: var(--text-secondary); font-size: 1rem; }

    .liquidity-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .liquidity-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;

      &:hover {
        border-color: var(--accent);
        transform: translateY(-5px);
        box-shadow: 0 12px 40px rgba(0,0,0,0.2);
      }

      &.expanded {
        background: var(--bg-card2);
        border-color: var(--accent);
        @media (min-width: 900px) { grid-column: span 2; }
      }
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .user-avatar {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--primary-light) 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 800;
      color: white;
      box-shadow: 0 4px 15px rgba(46, 158, 91, 0.3);
    }

    .user-info { flex: 1; }
    .user-name { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
    .liquidity-amount { font-size: 1.3rem; font-weight: 800; color: var(--accent); }

    .liquidity-details {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      animation: slideDown 0.3s ease-out;
    }

    .mini-table {
      width: 100%;
      border-collapse: collapse;
      th { text-align: right; color: var(--text-muted); padding: 0.5rem; font-weight: 600; border-bottom: 1px solid var(--border); }
      td { padding: 0.75rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.03); }
      .text-left { text-align: left; }
      .font-bold { font-weight: 700; }
      .text-danger { color: #f87171; }
    }

    .loader, .empty-state { text-align: center; padding: 5rem; color: var(--text-secondary); font-size: 1.2rem; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class GlobalLiquidityComponent implements OnInit {
  liquidityUsers: LiquidityUser[] = [];
  expandedUserId: string | null = null;
  loading = true;

  private api = inject(ApiService);
  private signalr = inject(SignalRService);
  private auth = inject(AuthService);

  constructor() {
    effect(() => {
      if (this.signalr.liquidityChanged() > 0) {
        this.fetchData();
      }
    });
  }

  ngOnInit(): void {
    this.signalr.startConnection();
    this.fetchData();
  }

  fetchData(): void {
    this.loading = true;
    const currentUser = this.auth.currentUser();

    // We fetch history and users to build a personalized liquidity report
    forkJoin({
      history: this.api.getAllDonations(),
      admins: this.api.getFinancialAdmins()
    }).subscribe({
      next: ({ history, admins }) => {
        const currentUser = this.auth.currentUser();
        const isFullAdmin = this.auth.isAdmin();
        const normalizedCurrentUser = this.normalizeArabic(currentUser?.fullName || '');
        
        // Filter by user if restricted (Hussam/Haitham) - show ONLY their own contributions
        let filteredActions = history;
        if (!isFullAdmin) {
          filteredActions = history.filter(d => 
            this.normalizeArabic(d.donorName || '') === normalizedCurrentUser ||
            this.normalizeArabic((d as any).createdByUserName || '') === normalizedCurrentUser
          );
        }

        // 1. Filter for "Liquidity" transactions
        const liquidityActions = filteredActions.filter(d => {
          const normCat = this.normalizeArabic(d.categoryName || '');
          return normCat.includes('سيوله');
        });

        // Group by (Holder, Recorder) if full admin, or just Holder if restricted
        const groups = new Map<string, LiquidityUser>();
        
        liquidityActions.forEach(d => {
          // Try multiple possible field names for the target manager ID
          const targetId = d.targetUserId || d.assignedUserId || d.recipientId || d.userId || (d as any).TargetUserId;
          if (!targetId) return;

          // Unique key for grouping
          const groupKey = isFullAdmin ? `${targetId}_${d.donorName}` : targetId;

          if (!groups.has(groupKey)) {
            const admin = admins.find(a => a.id === targetId);
            const recorderSuffix = isFullAdmin ? ` (${d.donorName})` : '';
            groups.set(groupKey, {
              userId: groupKey,
              fullName: (admin?.fullName || 'مسؤول مالي') + recorderSuffix,
              totalAmount: 0,
              breakdown: []
            });
          }

          const user = groups.get(groupKey)!;
          user.totalAmount += d.amount;

          let catDetail = user.breakdown.find((det: any) => det.categoryName === d.categoryName);
          if (!catDetail) {
            catDetail = { categoryName: d.categoryName, amount: 0 };
            user.breakdown.push(catDetail);
          }
          catDetail.amount += d.amount;
        });

        this.liquidityUsers = Array.from(groups.values()).sort((a, b) => b.totalAmount - a.totalAmount);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  toggleDetails(userId: string): void {
    this.expandedUserId = this.expandedUserId === userId ? null : userId;
  }

  private normalizeArabic(str: string): string {
    if (!str) return '';
    return str
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .trim()
      .toLowerCase();
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(val);
  }
}
