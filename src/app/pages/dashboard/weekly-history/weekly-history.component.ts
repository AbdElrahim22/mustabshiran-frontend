import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { forkJoin, catchError, of } from 'rxjs';
import Swal from 'sweetalert2';

interface WeekGroup {
  label: string;
  startDate: Date;
  endDate: Date;
  donations: any[];
}

@Component({
  selector: 'app-weekly-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <div>
          <h2 class="section-title">📅 سجل العمليات الأسبوعي</h2>
          <p class="section-desc">مراجعة وتعديل كافة التبرعات والخصومات مقسمة حسب الأسابيع</p>
        </div>
        <div class="header-btns">
          <button class="btn btn-reset" (click)="resetAllSettings()">🔄 استعادة الأسابيع المخفية</button>
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">⏳ جاري تحميل السجلات...</div>
      } @else {
        <!-- 'Excel' style Tabs -->
        <div class="weeks-tabs-container">
          <div class="tabs-scroll">
            @for (week of filteredWeeks; track week.label; let i = $index) {
              <div class="tab-wrapper" [class.active]="activeWeekIndex === i">
                <button class="week-tab" 
                        [class.active]="activeWeekIndex === i"
                        (click)="activeWeekIndex = i; scrollToActiveTab()">
                  {{ week.label }}
                </button>
                <button class="btn-hide-week" (click)="confirmHideWeek(week.label, $event)" title="حذف هذا الأسبوع من عرضي">✕</button>
              </div>
            }
          </div>
        </div>

        <div class="sheet-content">
          @if (filteredWeeks[activeWeekIndex]?.donations?.length) {
            
            <!-- Liquidity Table -->
            @let liquidity = getLiquidityDonations(filteredWeeks[activeWeekIndex].donations);
            @if (liquidity.length) {
              <div class="sub-section-title">💰 سجل السيولة</div>
              <div class="table-wrapper mb-4">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>بواسطة</th>
                      <th>إلى (المسؤول)</th>
                      <th>البند / المجال</th>
                      <th>المبلغ</th>
                      <th>التاريخ والوقت</th>
                      <th class="center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of liquidity; track d.id; let i = $index) {
                      <tr class="donation-row" [class.edit-mode]="editingId === d.id">
                        <td data-label="#">{{ i + 1 }}</td>
                        <td data-label="بواسطة">
                          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                            <div class="donor-name">{{ d.donorName }}</div>
                            <div class="donor-email">{{ d.donorEmail }}</div>
                          </div>
                        </td>
                        <td data-label="إلى (المسؤول)">
                          <div class="holder-name">{{ getHolderName(d) }}</div>
                        </td>
                        <td data-label="البند / المجال"><span class="category-tag liquidity">{{ d.categoryName }}</span></td>
                        
                        @if (editingId === d.id) {
                          <td class="amount-cell" data-label="المبلغ">
                            <input type="number" [(ngModel)]="editAmount" class="inline-input">
                          </td>
                          <td class="date-cell" data-label="التاريخ والوقت">{{ formatDate(d.createdAt) }}</td>
                          <td class="center actions" data-label="إجراءات">
                            <button class="btn-save" (click)="saveEdit(d)">✔️</button>
                            <button class="btn-cancel" (click)="cancelEdit()">❌</button>
                          </td>
                        } @else {
                          <td class="amount-cell" [class.negative]="d.amount < 0" data-label="المبلغ">
                            {{ formatCurrency(d.amount) }}
                            @if(d.amount < 0) { <span class="deduct-label">(خصم)</span> }
                          </td>
                          <td class="date-cell" data-label="التاريخ والوقت">{{ formatDate(d.createdAt) }}</td>
                          <td class="center actions" data-label="إجراءات">
                            <button class="btn-edit" (click)="startEdit(d)" title="تعديل">✏️</button>
                            <button class="btn-delete" (click)="deleteEntry(d)" title="حذف">🗑️</button>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="sub-total">إجمالي السيولة لهذا الأسبوع: <strong>{{ formatCurrency(getLiquidityTotal(liquidity)) }}</strong></div>
            }

            <!-- Items Table -->
            @let items = getItemDonations(filteredWeeks[activeWeekIndex].donations);
            @if (items.length) {
              <div class="sub-section-title">📦 سجل البنود (تبرعات / خصومات)</div>
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>بواسطة</th>
                      <th>البند / المجال</th>
                      <th>المبلغ</th>
                      <th>التاريخ والوقت</th>
                      <th class="center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of items; track d.id; let i = $index) {
                      <tr class="donation-row" [class.edit-mode]="editingId === d.id">
                        <td data-label="#">{{ i + 1 }}</td>
                        <td data-label="بواسطة">
                          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                            <div class="donor-name" [class.transfer-name]="d.type === 'Transfer'">{{ d.donorName }}</div>
                            <div class="donor-email">{{ d.donorEmail }}</div>
                          </div>
                        </td>
                        <td data-label="البند / المجال">
                          <span class="category-tag" [class.transfer-tag]="d.type === 'Transfer'">
                            {{ d.type === 'Transfer' ? '🔄 تحويل مالي (' + d.categoryName + ')' : d.categoryName }}
                          </span>
                        </td>
                        
                        @if (editingId === d.id) {
                          <td class="amount-cell" data-label="المبلغ">
                            <input type="number" [(ngModel)]="editAmount" class="inline-input">
                          </td>
                          <td class="date-cell" data-label="التاريخ والوقت">{{ formatDate(d.createdAt) }}</td>
                          <td class="center actions" data-label="إجراءات">
                            <button class="btn-save" (click)="saveEdit(d)">✔️</button>
                            <button class="btn-cancel" (click)="cancelEdit()">❌</button>
                          </td>
                        } @else {
                          <td class="amount-cell" [class.negative]="d.amount < 0" [class.transfer-amount]="d.type === 'Transfer'" data-label="المبلغ">
                            {{ formatCurrency(d.amount) }}
                            @if(d.type === 'Transfer') { <span class="deduct-label">(تحويل)</span> }
                            @else if(d.amount < 0) { <span class="deduct-label">(خصم)</span> }
                            @else { <span class="deduct-label" style="color: #10b981;">(إيداع)</span> }
                          </td>
                          <td class="date-cell" data-label="التاريخ والوقت">{{ formatDate(d.createdAt) }}</td>
                          <td class="center actions" data-label="إجراءات">
                            @if (d.type !== 'Transfer') {
                              <button class="btn-edit" (click)="startEdit(d)" title="تعديل">✏️</button>
                              <button class="btn-delete" (click)="deleteEntry(d)" title="حذف">🗑️</button>
                            } @else {
                              <span style="font-size: 0.8rem; color: #888;">يُدار من شاشة التحويلات</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="sub-total">إجمالي البنود لهذا الأسبوع: <strong>{{ formatCurrency(getItemsTotal(items)) }}</strong></div>
            }

          } @else {
            <div class="empty-sheet">
              📭 لا توجد عمليات مسجلة في هذا الأسبوع 
              <div class="debug-info">(إجمالي العمليات المستلمة من السيرفر: {{ rawDonationsCount }})</div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { animation: fadeIn 0.4s ease-out; }
    .header-actions { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 1.5rem; 
      gap: 1rem;
      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
        text-align: center;
      }
    }
    .header-btns { 
      display: flex; 
      gap: 10px; 
      @media (max-width: 768px) {
        flex-direction: column;
      }
    }
    .section-title { font-size: 1.5rem; font-weight: 800; }
    .btn-reset { 
      background: rgba(239, 68, 68, 0.1); 
      color: #ef4444; 
      border: 1px solid rgba(239, 68, 68, 0.2);
      &:hover { background: #ef4444; color: white; }
    }
    .section-desc { color: var(--text-secondary); font-size: 0.9rem; }
    .sub-section-title { 
      font-size: 1.1rem; 
      font-weight: 700; 
      color: var(--accent); 
      margin-bottom: 1rem; 
      padding-bottom: 0.5rem; 
      border-bottom: 1px dashed rgba(255,255,255,0.1);
    }
    .sub-total {
      text-align: left;
      font-size: 0.95rem;
      color: var(--text-secondary);
      margin-top: 0.75rem;
      strong { color: var(--accent); }
    }
    .mb-4 { margin-bottom: 2.5rem; }

    /* Tabs UI */
    .weeks-tabs-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px 12px 0 0;
      padding: 0.5rem 0.5rem 0;
      overflow: hidden;
      position: relative;
      
      /* Gradient indicator for scroll */
      &::after {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 30px;
        background: linear-gradient(to right, var(--bg-card), transparent);
        pointer-events: none;
        opacity: 0;
        transition: 0.3s;
      }
      &.can-scroll-left::after { opacity: 1; }
    }

    .tabs-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--primary) transparent;
      &::-webkit-scrollbar { height: 4px; }
      &::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 10px; }
      padding-bottom: 8px;
      -webkit-overflow-scrolling: touch;
    }

    .tab-wrapper {
      display: flex;
      align-items: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      transition: all 0.2s;
      position: relative;
      flex-shrink: 0;
      min-width: 140px;

      &.active {
        background: var(--bg-dark);
        border-color: var(--accent);
        z-index: 2;
        &::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--bg-dark);
        }
      }

      @media (max-width: 600px) {
        min-width: 120px;
      }
    }

    .week-tab {
      padding: 0.75rem 1rem 0.75rem 1.25rem;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      flex: 1;
      text-align: center;
      &:hover { color: var(--text-primary); }
      &.active { color: var(--accent); }
    }

    .btn-hide-week {
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.2);
      padding: 0 8px;
      cursor: pointer;
      font-size: 0.7rem;
      transition: 0.2s;
      &:hover { color: #ef4444; transform: scale(1.2); }
    }

    .sheet-content {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 1.5rem;
      min-height: 400px;
      @media (max-width: 768px) {
        padding: 1rem;
      }
    }

    .table-wrapper { 
      overflow-x: auto; 
      margin: 0 -0.5rem;
      padding: 0 0.5rem;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      tr { border-bottom: 1px solid rgba(255,255,255,0.03); }
      th { text-align: right; padding: 1rem; color: var(--text-muted); font-size: 0.85rem; }
      td { padding: 1rem; vertical-align: middle; }
    }

    .donor-name { font-weight: 700; color: var(--text-primary); font-size: 0.95rem; }
    .transfer-name { color: #3b82f6; font-style: italic; }
    .donor-email { font-size: 0.75rem; color: var(--text-muted); }
    .holder-name { font-weight: 600; color: var(--accent); font-size: 0.9rem; }
    .category-tag {
      background: rgba(46,158,91,0.1);
      color: var(--primary-light);
      padding: 4px 10px;
      border-radius: 50px;
      font-size: 0.8rem;
      white-space: nowrap;
      &.liquidity {
        background: rgba(250,204,21,0.1);
        color: #facc15;
      }
      &.transfer-tag {
        background: rgba(59,130,246,0.15);
        color: #60a5fa;
        border: 1px dashed rgba(59,130,246,0.4);
      }
    }

    .amount-cell {
      font-weight: 800;
      font-size: 1.1rem;
      white-space: nowrap;
      &.negative { color: #f87171; }
      &.transfer-amount { color: #60a5fa; }
      .deduct-label { font-size: 0.75rem; font-weight: 600; margin-right: 6px; }
    }

    .inline-input {
      background: var(--bg-dark);
      border: 1px solid var(--accent);
      color: var(--text-primary);
      padding: 6px 10px;
      border-radius: 6px;
      width: 100px;
      font-weight: 800;
      outline: none;
    }

    .center { text-align: center; }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: center;
      button {
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--border);
        color: var(--text-primary);
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: 0.2s;
        &:hover { transform: scale(1.1); background: rgba(255,255,255,0.1); }
      }
      .btn-save { color: #10b981; border-color: #10b981; }
      .btn-cancel { color: #ef4444; border-color: #ef4444; }
      .btn-delete:hover { border-color: #ef4444; color: #ef4444; }
      .btn-edit:hover { border-color: #60a5fa; color: #60a5fa; }
    }

    .sheet-footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      text-align: left;
      font-size: 1.1rem;
      strong { color: var(--accent); font-size: 1.4rem; }
    }

    .empty-sheet { text-align: center; padding: 4rem 1rem; color: var(--text-muted); font-size: 1.1rem; }
    .debug-info { font-size: 0.8rem; color: var(--text-muted); margin-top: 10px; font-family: monospace; }
    .loading-state { text-align: center; padding: 5rem; color: var(--text-secondary); }
  `]
})
export class WeeklyHistoryComponent implements OnInit {
  weeks: WeekGroup[] = [];
  hiddenWeekLabels: string[] = [];
  activeWeekIndex = 0;
  loading = true;
  rawDonationsCount = 0;
  financialAdmins: any[] = [];

  editingId: string | null = null;
  editAmount: number = 0;

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private signalr = inject(SignalRService);

  constructor() {
    effect(() => {
      if (this.signalr.liquidityChanged() > 0) {
        this.loadHistory();
      }
    });
  }

  ngOnInit(): void {
    this.signalr.startConnection();
    this.loadHiddenWeeks();
    this.loadHistory();
  }

  private loadHiddenWeeks(): void {
    const userId = this.auth.currentUser()?.userId;
    if (!userId) return;
    const stored = localStorage.getItem(`hidden_weeks_${userId}`);
    if (stored) {
      try {
        this.hiddenWeekLabels = JSON.parse(stored);
      } catch (e) {
        this.hiddenWeekLabels = [];
      }
    }
  }

  get filteredWeeks(): WeekGroup[] {
    return this.weeks.filter(w => !this.hiddenWeekLabels.includes(w.label));
  }

  confirmHideWeek(label: string, event: Event): void {
    event.stopPropagation();
    Swal.fire({
      title: 'حذف الأسبوع من عرضك؟',
      text: 'سيتم إخفاء هذا الأسبوع تماماً من واجهتك الشخصية فقط. لن يتأثر باقي المسؤولين بهذا الإجراء.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'نعم، إخفاء نهائياً',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        this.hideWeek(label);
      }
    });
  }

  private hideWeek(label: string): void {
    const userId = this.auth.currentUser()?.userId;
    if (!userId) return;
    
    // Update reference to trigger change detection
    this.hiddenWeekLabels = [...this.hiddenWeekLabels, label];
    localStorage.setItem(`hidden_weeks_${userId}`, JSON.stringify(this.hiddenWeekLabels));
    
    // Always go to the first available week (most recent) after hiding
    this.activeWeekIndex = 0;
    
    this.toast.success('تم إخفاء الأسبوع بنجاح من عرضك الشخصي ✅');
  }

  loadHistory(): void {
    this.loading = true;
    
    forkJoin({
      history: this.api.getAllDonations(),
      admins: this.api.getFinancialAdmins().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ history, admins }) => {
        this.rawDonationsCount = history?.length || 0;
        this.financialAdmins = admins;
        
        // Show ALL history to everyone for full transparency
        this.groupDonationsByWeek(history);
        this.loading = false;
      },
      error: () => {
        this.toast.error('حدث خطأ أثناء تحميل السجل');
        this.loading = false;
      }
    });
  }

  private groupDonationsByWeek(donations: any[]): void {
    const weekMap = new Map<string, { label: string, start: Date, end: Date, items: any[] }>();
    
    const now = new Date();
    
    // Find oldest date
    let oldestDate = now;
    if (donations && donations.length) {
      const minTime = Math.min(...donations.map(d => new Date(d.createdAt).getTime()));
      oldestDate = new Date(minTime);
    }
    
    // Get start of the oldest week and current week
    const oldestWeekInfo = this.getWeekRangeLabel(oldestDate);
    const currentWeekInfo = this.getWeekRangeLabel(now);
    
    // Generate all weeks between oldest and current
    let currentIterDate = new Date(oldestWeekInfo.start);
    const endIterDate = new Date(currentWeekInfo.start);
    
    // Normalize to exact midnight to prevent any DST timezone shift issues
    currentIterDate.setHours(0, 0, 0, 0);
    endIterDate.setHours(0, 0, 0, 0);
    
    while (currentIterDate.getTime() <= endIterDate.getTime()) {
      const weekInfo = this.getWeekRangeLabel(currentIterDate);
      if (!weekMap.has(weekInfo.label)) {
        weekMap.set(weekInfo.label, {
          label: weekInfo.label,
          start: weekInfo.start,
          end: weekInfo.end,
          items: []
        });
      }
      // Move to the next week safely (creates a fresh date object avoiding DST shifts)
      currentIterDate = new Date(currentIterDate.getFullYear(), currentIterDate.getMonth(), currentIterDate.getDate() + 7);
    }

    if (donations && donations.length) {
      donations.forEach(d => {
        const date = new Date(d.createdAt);
        const weekInfo = this.getWeekRangeLabel(date);
        if (weekMap.has(weekInfo.label)) {
          weekMap.get(weekInfo.label)?.items.push(d);
        } else {
          weekMap.set(weekInfo.label, {
            label: weekInfo.label,
            start: weekInfo.start,
            end: weekInfo.end,
            items: [d]
          });
        }
      });
    }

    this.weeks = Array.from(weekMap.values()).map(w => {
      return {
        label: w.label,
        donations: w.items,
        startDate: w.start,
        endDate: w.end
      };
    }).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

    // Always reset to the newest week (which is the current week) after processing
    this.activeWeekIndex = 0;
    this.scrollToActiveTab();
  }

  getLiquidityDonations(donations: any[]): any[] {
    if (!donations) return [];
    return donations.filter(d => this.normalizeArabic(d.categoryName).includes('سيوله'));
  }

  getLiquidityTotal(donations: any[]): number {
    return donations.reduce((acc, d) => acc + d.amount, 0);
  }

  getItemDonations(donations: any[]): any[] {
    if (!donations) return [];
    return donations.filter(d => !this.normalizeArabic(d.categoryName).includes('سيوله'));
  }

  getItemsTotal(donations: any[]): number {
    return donations.reduce((acc, d) => acc + d.amount, 0);
  }

  getHolderName(d: any): string {
    // Check all possible ID fields from different API versions
    const targetId = d.targetUserId || d.assignedUserId || d.recipientId || d.userId || 
                     d.TargetUserId || d.AssignedUserId || d.RecipientId;
    
    if (!targetId) return '—';
    
    const admin = this.financialAdmins.find(a => a.id === targetId || a.userId === targetId);
    if (admin) return admin.fullName || admin.userName;
    
    // Fallback if ID matches current user but not in admin list yet
    if (targetId === this.auth.currentUser()?.userId) return this.auth.currentUser()?.fullName || 'أنا';
    
    return 'مسؤول مالي';
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

  private getWeekRangeLabel(date: Date): { label: string, start: Date, end: Date } {
    const d = new Date(date);
    const day = d.getDay(); 
    
    // Friday (5) is the start day. 
    // Calculate difference to get back to the most recent Friday.
    const diff = d.getDate() - ((day + 7 - 5) % 7);
    
    const start = new Date(d.getFullYear(), d.getMonth(), diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const options: any = { month: 'short', day: 'numeric' };
    const label = `أسبوع ${start.toLocaleDateString('ar-EG', options)} - ${end.toLocaleDateString('ar-EG', options)}`;
    return { label, start, end };
  }

  get weekTotal(): number {
    return this.filteredWeeks[this.activeWeekIndex]?.donations.reduce((acc, d) => acc + d.amount, 0) || 0;
  }

  startEdit(d: any): void {
    this.editingId = d.id;
    this.editAmount = Math.abs(d.amount);
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(d: any): void {
    if (!this.editAmount || this.editAmount <= 0) return;
    
    // In backend, deductions are negative, donations are positive
    // We treat 'edit' as updating the magnitude
    this.api.updateDonation(d.id, { categoryId: d.categoryId, amount: this.editAmount }).subscribe({
      next: () => {
        this.toast.success('تم التعديل بنجاح ✅');
        this.editingId = null;
        this.loadHistory();
      },
      error: () => this.toast.error('حدث خطأ أثناء التعديل')
    });
  }

  deleteEntry(d: any): void {
    Swal.fire({
      title: 'حذف العملية؟',
      text: 'سيتم حذف هذا السجل نهائياً من كافة التقارير.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.deleteDonation(d.id).subscribe({
          next: () => {
            this.toast.success('تم الحذف بنجاح ✅');
            this.loadHistory();
          },
          error: () => this.toast.error('حدث خطأ أثناء الحذف')
        });
      }
    });
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(val);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('ar-EG');
  }

  resetAllSettings(): void {
    const userId = this.auth.currentUser()?.userId;
    if (userId) {
      localStorage.removeItem(`hidden_weeks_${userId}`);
      this.hiddenWeekLabels = [];
      this.toast.success('تم استعادة كافة الأسابيع بنجاح ✅');
      this.loadHistory();
    }
  }

  scrollToActiveTab(): void {
    setTimeout(() => {
      const activeTab = document.querySelector('.tab-wrapper.active');
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 100);
  }
}
