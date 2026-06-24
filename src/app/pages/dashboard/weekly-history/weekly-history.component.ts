import { Component, OnInit, inject, effect } from '@angular/core';
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

        <!-- ─── Main Mode Tabs ─── -->
        <div class="main-mode-tabs">
          <button class="mode-tab" [class.active]="mainTab === 'weekly'" (click)="mainTab = 'weekly'">
            📅 السجل الأسبوعي
          </button>
          <button class="mode-tab search-mode-tab" [class.active]="mainTab === 'search'"
                  (click)="mainTab = 'search'; buildUniqueCategories()">
            🔍 بحث بالبند
          </button>
        </div>

        <!-- ═══════ WEEKLY TAB ═══════ -->
        @if (mainTab === 'weekly') {
          <div class="weeks-tabs-container">
            <div class="tabs-scroll">
              @for (week of filteredWeeks; track week.label; let i = $index) {
                <div class="tab-wrapper" [class.active]="activeWeekIndex === i">
                  <button class="week-tab"
                          [class.active]="activeWeekIndex === i"
                          (click)="activeWeekIndex = i; scrollToActiveTab()">
                    {{ week.label }}
                  </button>
                  <button class="btn-hide-week" (click)="confirmHideWeek(week.label, $event)" title="إخفاء من عرضي">✕</button>
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
                            <div style="display:flex;flex-direction:column;gap:2px;">
                              <div class="donor-name">{{ d.donorName }}</div>
                              <div class="donor-email">{{ d.donorEmail }}</div>
                            </div>
                          </td>
                          <td data-label="إلى (المسؤول)"><div class="holder-name">{{ getHolderName(d) }}</div></td>
                          <td data-label="البند"><span class="category-tag liquidity">{{ d.categoryName }}</span></td>
                          @if (editingId === d.id) {
                            <td class="amount-cell" data-label="المبلغ"><input type="number" [(ngModel)]="editAmount" class="inline-input"></td>
                            <td class="date-cell" data-label="التاريخ">{{ formatDate(d.createdAt) }}</td>
                            <td class="center actions"><button class="btn-save" (click)="saveEdit(d)">✔️</button><button class="btn-cancel" (click)="cancelEdit()">❌</button></td>
                          } @else {
                            <td class="amount-cell" [class.negative]="d.amount < 0" data-label="المبلغ">
                              {{ formatCurrency(d.amount) }}
                              @if(d.amount < 0) { <span class="deduct-label">(خصم)</span> }
                            </td>
                            <td class="date-cell" data-label="التاريخ">{{ formatDate(d.createdAt) }}</td>
                            <td class="center actions"><button class="btn-edit" (click)="startEdit(d)" title="تعديل">✏️</button><button class="btn-delete" (click)="deleteEntry(d)" title="حذف">🗑️</button></td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="sub-total">إجمالي السيولة: <strong>{{ formatCurrency(getLiquidityTotal(liquidity)) }}</strong></div>
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
                            <div style="display:flex;flex-direction:column;gap:2px;">
                              <div class="donor-name" [class.transfer-name]="d.type === 'Transfer'">{{ d.donorName }}</div>
                              <div class="donor-email">{{ d.donorEmail }}</div>
                            </div>
                          </td>
                          <td data-label="البند">
                            <span class="category-tag" [class.transfer-tag]="d.type === 'Transfer'">
                              {{ d.type === 'Transfer' ? '🔄 تحويل مالي (' + d.categoryName + ')' : d.categoryName }}
                            </span>
                          </td>
                          @if (editingId === d.id) {
                            <td class="amount-cell" data-label="المبلغ"><input type="number" [(ngModel)]="editAmount" class="inline-input"></td>
                            <td class="date-cell" data-label="التاريخ">{{ formatDate(d.createdAt) }}</td>
                            <td class="center actions"><button class="btn-save" (click)="saveEdit(d)">✔️</button><button class="btn-cancel" (click)="cancelEdit()">❌</button></td>
                          } @else {
                            <td class="amount-cell" [class.negative]="d.amount < 0" [class.transfer-amount]="d.type === 'Transfer'" data-label="المبلغ">
                              {{ formatCurrency(d.amount) }}
                              @if(d.type === 'Transfer') { <span class="deduct-label">(تحويل)</span> }
                              @else if(d.amount < 0) { <span class="deduct-label">(خصم)</span> }
                              @else { <span class="deduct-label" style="color:#10b981;">(إيداع)</span> }
                            </td>
                            <td class="date-cell" data-label="التاريخ">{{ formatDate(d.createdAt) }}</td>
                            <td class="center actions">
                              @if (d.type !== 'Transfer') {
                                <button class="btn-edit" (click)="startEdit(d)" title="تعديل">✏️</button>
                                <button class="btn-delete" (click)="deleteEntry(d)" title="حذف">🗑️</button>
                              } @else {
                                <span style="font-size:0.8rem;color:#888;">يُدار من التحويلات</span>
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="sub-total">إجمالي البنود: <strong>{{ formatCurrency(getItemsTotal(items)) }}</strong></div>
              }

            } @else {
              <div class="empty-sheet">
                📭 لا توجد عمليات مسجلة في هذا الأسبوع
                <div class="debug-info">(إجمالي العمليات المستلمة من السيرفر: {{ rawDonationsCount }})</div>
              </div>
            }
          </div>
        }

        <!-- ═══════ SEARCH BY CATEGORY TAB ═══════ -->
        @if (mainTab === 'search') {
          <div class="search-panel">

            <!-- Filter Bar -->
            <div class="search-filters">
              <div class="filter-group">
                <label class="filter-label">📦 اختر البند</label>
                <div class="select-wrapper">
                  <select [(ngModel)]="searchCategoryId" (ngModelChange)="runCategorySearch()" class="filter-select">
                    <option value="">-- اختر بنداً --</option>
                    @for (cat of uniqueCategories; track cat.id) {
                      <option [value]="cat.name">{{ cat.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="filter-group">
                <label class="filter-label">📅 من تاريخ</label>
                <input type="date" [(ngModel)]="searchDateFrom" (ngModelChange)="runCategorySearch()" class="filter-input">
              </div>

              <div class="filter-group">
                <label class="filter-label">📅 إلى تاريخ</label>
                <input type="date" [(ngModel)]="searchDateTo" (ngModelChange)="runCategorySearch()" class="filter-input">
              </div>

              @if (searchCategoryId || searchDateFrom || searchDateTo) {
                <button class="btn-clear-filter" (click)="clearSearch()">✕ مسح الفلتر</button>
              }
            </div>

            <!-- Results -->
            @if (!searchCategoryId) {
              <div class="search-hint">
                <span style="font-size:2.5rem;">🔍</span>
                <p>اختر بنداً من القائمة أعلاه لعرض جميع تبرعاته</p>
              </div>
            } @else if (categorySearchResults.length === 0) {
              <div class="search-hint">
                <span style="font-size:2.5rem;">📭</span>
                <p>لا توجد نتائج بهذا الفلتر</p>
              </div>
            } @else {
              <!-- Summary Cards -->
              <div class="search-summary">
                <div class="summary-card">
                  <span class="summary-label">عدد العمليات</span>
                  <span class="summary-val">{{ categorySearchResults.length }}</span>
                </div>
                <div class="summary-card accent">
                  <span class="summary-label">الإجمالي</span>
                  <span class="summary-val">{{ formatCurrency(getCategorySearchTotal()) }}</span>
                </div>
              </div>

              <!-- Results Table -->
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>بواسطة</th>
                      <th>البند</th>
                      <th>المبلغ</th>
                      <th>التاريخ والوقت</th>
                      <th>ملاحظات</th>
                      <th class="center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of categorySearchResults; track d.id; let i = $index) {
                      <tr class="donation-row" [class.edit-mode]="editingId === d.id">
                        <td data-label="#">{{ i + 1 }}</td>
                        <td data-label="بواسطة">
                          <div style="display:flex;flex-direction:column;gap:2px;">
                            <div class="donor-name">{{ d.donorName }}</div>
                            <div class="donor-email">{{ d.donorEmail }}</div>
                          </div>
                        </td>
                        <td data-label="البند"><span class="category-tag">{{ d.categoryName }}</span></td>
                        @if (editingId === d.id) {
                          <td class="amount-cell" data-label="المبلغ"><input type="number" [(ngModel)]="editAmount" class="inline-input"></td>
                          <td class="date-cell" data-label="التاريخ">{{ formatDate(d.createdAt) }}</td>
                          <td data-label="ملاحظات" style="color:var(--text-muted);font-size:0.85rem;">{{ d.notes || '—' }}</td>
                          <td class="center actions"><button class="btn-save" (click)="saveEditSearch(d)">✔️</button><button class="btn-cancel" (click)="cancelEdit()">❌</button></td>
                        } @else {
                          <td class="amount-cell" [class.negative]="d.amount < 0" data-label="المبلغ">
                            {{ formatCurrency(d.amount) }}
                            @if(d.amount < 0) { <span class="deduct-label">(خصم)</span> }
                            @else { <span class="deduct-label" style="color:#10b981;">(إيداع)</span> }
                          </td>
                          <td class="date-cell" data-label="التاريخ">{{ formatDate(d.createdAt) }}</td>
                          <td data-label="ملاحظات" style="color:var(--text-muted);font-size:0.85rem;font-style:italic;">{{ d.notes || '—' }}</td>
                          <td class="center actions">
                            @if (d.type !== 'Transfer') {
                              <button class="btn-edit" (click)="startEdit(d)" title="تعديل">✏️</button>
                              <button class="btn-delete" (click)="deleteSearchEntry(d)" title="حذف">🗑️</button>
                            } @else {
                              <span style="font-size:0.8rem;color:#888;">تحويل</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

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
      @media (max-width: 768px) { flex-direction: column; align-items: stretch; text-align: center; }
    }
    .header-btns { display: flex; gap: 10px; align-items: center; }
    .section-title { font-size: 1.5rem; font-weight: 800; }
    .section-desc { color: var(--text-secondary); font-size: 0.9rem; }
    .btn-reset {
      background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);
      &:hover { background: #ef4444; color: white; }
    }

    /* ─── Main Mode Tabs ─── */
    .main-mode-tabs {
      display: flex;
      gap: 0;
      border-bottom: 2px solid var(--border);
      margin-bottom: 0;
    }
    .mode-tab {
      padding: 0.75rem 1.6rem;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      color: var(--text-secondary);
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      &:hover { color: var(--text-primary); }
      &.active { color: var(--accent); border-bottom-color: var(--accent); }
    }
    .search-mode-tab.active { color: #a78bfa; border-bottom-color: #a78bfa; }

    /* ─── Weekly Tabs UI ─── */
    .weeks-tabs-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 0 0;
      padding: 0.5rem 0.5rem 0;
      overflow: hidden;
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
    }
    .tab-wrapper {
      display: flex;
      align-items: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      flex-shrink: 0;
      min-width: 140px;
      position: relative;
      transition: all 0.2s;
      &.active {
        background: var(--bg-dark);
        border-color: var(--accent);
        z-index: 2;
        &::after {
          content: '';
          position: absolute;
          bottom: -2px; left: 0; right: 0;
          height: 3px;
          background: var(--bg-dark);
        }
      }
      @media (max-width: 600px) { min-width: 120px; }
    }
    .week-tab {
      padding: 0.75rem 1rem 0.75rem 1.25rem;
      background: transparent; border: none;
      color: var(--text-secondary);
      font-size: 0.85rem; font-weight: 600;
      cursor: pointer; white-space: nowrap;
      flex: 1; text-align: center; transition: 0.2s;
      &:hover { color: var(--text-primary); }
      &.active { color: var(--accent); }
    }
    .btn-hide-week {
      background: transparent; border: none;
      color: rgba(255,255,255,0.2);
      padding: 0 8px; cursor: pointer; font-size: 0.7rem;
      &:hover { color: #ef4444; transform: scale(1.2); }
    }

    /* ─── Sheet Content ─── */
    .sheet-content {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 1.5rem;
      min-height: 400px;
      @media (max-width: 768px) { padding: 1rem; }
    }
    .sub-section-title {
      font-size: 1.1rem; font-weight: 700; color: var(--accent);
      margin-bottom: 1rem; padding-bottom: 0.5rem;
      border-bottom: 1px dashed rgba(255,255,255,0.1);
    }
    .sub-total {
      text-align: left; font-size: 0.95rem;
      color: var(--text-secondary); margin-top: 0.75rem;
      strong { color: var(--accent); }
    }
    .mb-4 { margin-bottom: 2.5rem; }

    /* ─── Table ─── */
    .table-wrapper { overflow-x: auto; margin: 0 -0.5rem; padding: 0 0.5rem; }
    .data-table {
      width: 100%; border-collapse: collapse;
      tr { border-bottom: 1px solid rgba(255,255,255,0.03); }
      th { text-align: right; padding: 1rem; color: var(--text-muted); font-size: 0.85rem; }
      td { padding: 1rem; vertical-align: middle; }
    }
    .donor-name { font-weight: 700; color: var(--text-primary); font-size: 0.95rem; }
    .transfer-name { color: #3b82f6; font-style: italic; }
    .donor-email { font-size: 0.75rem; color: var(--text-muted); }
    .holder-name { font-weight: 600; color: var(--accent); font-size: 0.9rem; }
    .category-tag {
      background: rgba(46,158,91,0.1); color: var(--primary-light);
      padding: 4px 10px; border-radius: 50px; font-size: 0.8rem; white-space: nowrap;
      &.liquidity { background: rgba(250,204,21,0.1); color: #facc15; }
      &.transfer-tag { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px dashed rgba(59,130,246,0.4); }
    }
    .amount-cell {
      font-weight: 800; font-size: 1.1rem; white-space: nowrap;
      &.negative { color: #f87171; }
      &.transfer-amount { color: #60a5fa; }
      .deduct-label { font-size: 0.75rem; font-weight: 600; margin-right: 6px; }
    }
    .inline-input {
      background: var(--bg-dark); border: 1px solid var(--accent);
      color: var(--text-primary); padding: 6px 10px;
      border-radius: 6px; width: 100px; font-weight: 800; outline: none;
    }
    .center { text-align: center; }
    .actions {
      display: flex; gap: 8px; justify-content: center;
      button {
        background: rgba(255,255,255,0.05); border: 1px solid var(--border);
        color: var(--text-primary); padding: 6px 12px; border-radius: 8px;
        cursor: pointer; transition: 0.2s;
        &:hover { transform: scale(1.1); background: rgba(255,255,255,0.1); }
      }
      .btn-save { color: #10b981; border-color: #10b981; }
      .btn-cancel { color: #ef4444; border-color: #ef4444; }
      .btn-delete:hover { border-color: #ef4444; color: #ef4444; }
      .btn-edit:hover { border-color: #60a5fa; color: #60a5fa; }
    }
    .empty-sheet { text-align: center; padding: 4rem 1rem; color: var(--text-muted); font-size: 1.1rem; }
    .debug-info { font-size: 0.8rem; color: var(--text-muted); margin-top: 10px; font-family: monospace; }
    .loading-state { text-align: center; padding: 5rem; color: var(--text-secondary); }

    /* ─── Search Panel ─── */
    .search-panel {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 1.5rem;
      min-height: 400px;
      animation: fadeIn 0.3s ease;
      @media (max-width: 768px) { padding: 1rem; }
    }
    .search-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-end;
      background: rgba(167,139,250,0.05);
      border: 1px solid rgba(167,139,250,0.15);
      border-radius: 12px;
      padding: 1.2rem;
      margin-bottom: 1.5rem;
    }
    .filter-group {
      display: flex; flex-direction: column; gap: 6px;
      flex: 1; min-width: 180px;
    }
    .filter-label {
      font-size: 0.8rem; font-weight: 700; color: #a78bfa; letter-spacing: 0.5px;
    }
    .filter-select, .filter-input {
      background: var(--bg-dark); border: 1px solid var(--border);
      color: var(--text-primary); padding: 0.65rem 1rem;
      border-radius: 10px; font-size: 0.9rem; outline: none;
      width: 100%; transition: border-color 0.2s; font-family: inherit;
      &:focus { border-color: #a78bfa; }
      option { background: #1e1e2e; }
    }
    .select-wrapper { position: relative; }
    .btn-clear-filter {
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
      color: #ef4444; padding: 0.65rem 1.2rem; border-radius: 10px;
      cursor: pointer; font-weight: 700; font-size: 0.85rem;
      transition: 0.2s; align-self: flex-end;
      &:hover { background: #ef4444; color: white; }
    }
    .search-hint {
      display: flex; flex-direction: column; align-items: center;
      gap: 1rem; padding: 4rem 1rem;
      color: var(--text-muted); font-size: 1rem; text-align: center;
    }
    .search-summary {
      display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .summary-card {
      background: rgba(255,255,255,0.04); border: 1px solid var(--border);
      border-radius: 12px; padding: 0.9rem 1.5rem;
      display: flex; flex-direction: column; gap: 4px;
      &.accent { border-color: rgba(167,139,250,0.3); background: rgba(167,139,250,0.07); }
    }
    .summary-label { font-size: 0.78rem; color: var(--text-muted); font-weight: 600; }
    .summary-val { font-size: 1.4rem; font-weight: 800; color: var(--accent); }
    .accent .summary-val { color: #a78bfa; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class WeeklyHistoryComponent implements OnInit {
  weeks: WeekGroup[] = [];
  hiddenWeekLabels: string[] = [];
  activeWeekIndex = 0;
  loading = true;
  rawDonationsCount = 0;
  financialAdmins: any[] = [];
  allDonations: any[] = [];

  // Weekly tab state
  editingId: string | null = null;
  editAmount: number = 0;

  // Main tab switch
  mainTab: 'weekly' | 'search' = 'weekly';

  // Search-by-category state
  uniqueCategories: { id: string; name: string }[] = [];
  searchCategoryId: string = '';
  searchDateFrom: string = '';
  searchDateTo: string = '';
  categorySearchResults: any[] = [];

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
      try { this.hiddenWeekLabels = JSON.parse(stored); }
      catch (e) { this.hiddenWeekLabels = []; }
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
      if (result.isConfirmed) { this.hideWeek(label); }
    });
  }

  private hideWeek(label: string): void {
    const userId = this.auth.currentUser()?.userId;
    if (!userId) return;
    this.hiddenWeekLabels = [...this.hiddenWeekLabels, label];
    localStorage.setItem(`hidden_weeks_${userId}`, JSON.stringify(this.hiddenWeekLabels));
    this.activeWeekIndex = 0;
    this.toast.success('تم إخفاء الأسبوع بنجاح من عرضك الشخصي ✅');
  }

  loadHistory(): void {
    this.loading = true;
    forkJoin({
      history: this.api.getAllDonations(),
      admins: this.api.getFinancialAdmins().pipe(catchError(() => of([]))),
      categories: this.api.getCategories().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ history, admins, categories }) => {
        this.rawDonationsCount = history?.length || 0;
        this.financialAdmins = admins;
        this.allDonations = history || [];
        // Build full categories list from API (all categories, not just those with donations)
        this.uniqueCategories = (categories || [])
          .filter((c: any) => !c.isDeleted && !this.normalizeArabic(c.name || '').includes('سيوله'))
          .map((c: any) => ({ id: c.id, name: c.name }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ar'));
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
    let oldestDate = now;
    if (donations && donations.length) {
      const minTime = Math.min(...donations.map(d => new Date(d.createdAt).getTime()));
      oldestDate = new Date(minTime);
    }
    const oldestWeekInfo = this.getWeekRangeLabel(oldestDate);
    const currentWeekInfo = this.getWeekRangeLabel(now);
    let currentIterDate = new Date(oldestWeekInfo.start);
    const endIterDate = new Date(currentWeekInfo.start);
    currentIterDate.setHours(0, 0, 0, 0);
    endIterDate.setHours(0, 0, 0, 0);
    while (currentIterDate.getTime() <= endIterDate.getTime()) {
      const weekInfo = this.getWeekRangeLabel(currentIterDate);
      if (!weekMap.has(weekInfo.label)) {
        weekMap.set(weekInfo.label, { label: weekInfo.label, start: weekInfo.start, end: weekInfo.end, items: [] });
      }
      currentIterDate = new Date(currentIterDate.getFullYear(), currentIterDate.getMonth(), currentIterDate.getDate() + 7);
    }
    if (donations && donations.length) {
      donations.forEach(d => {
        const date = new Date(d.createdAt);
        const weekInfo = this.getWeekRangeLabel(date);
        if (weekMap.has(weekInfo.label)) {
          weekMap.get(weekInfo.label)?.items.push(d);
        } else {
          weekMap.set(weekInfo.label, { label: weekInfo.label, start: weekInfo.start, end: weekInfo.end, items: [d] });
        }
      });
    }
    this.weeks = Array.from(weekMap.values()).map(w => ({
      label: w.label, donations: w.items, startDate: w.start, endDate: w.end
    })).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    this.activeWeekIndex = 0;
    this.scrollToActiveTab();
  }

  // ─── Search by Category ───────────────────────────────────────────────

  buildUniqueCategories(): void {
    // This is now a fallback only — main loading happens in loadHistory()
    // It builds the list from existing donations if categories API failed
    if (this.uniqueCategories.length > 0) return; // already loaded from API
    const seenNames = new Map<string, { id: string; name: string }>();
    (this.allDonations || []).forEach(d => {
      const cat = d.category || d.Category;
      const id = d.categoryId || d.CategoryId || cat?.id || cat?.Id || cat?.ID || '';
      const name = d.categoryName || d.CategoryName || cat?.name || cat?.Name || '';
      if (!name) return;
      const normName = this.normalizeArabic(name);
      if (normName.includes('سيوله')) return;
      if (!seenNames.has(normName)) {
        seenNames.set(normName, { id: id || name, name });
      }
    });
    this.uniqueCategories = Array.from(seenNames.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }

  runCategorySearch(): void {
    if (!this.searchCategoryId) {
      this.categorySearchResults = [];
      return;
    }
    
    const currentUser = this.auth.currentUser();
    const currentUserId = currentUser?.userId;
    const currentUserEmail = currentUser?.email;

    // searchCategoryId can be either an actual ID or the name (fallback)
    let results = (this.allDonations || []).filter(d => {
      // 1. Filter by the current logged-in user (match by email or user ID)
      const isMyDonation = !!(
        (currentUserEmail && d.donorEmail === currentUserEmail) || 
        (currentUserId && (d.userId === currentUserId || d.UserId === currentUserId || 
                           d.createdBy === currentUserId || d.CreatedBy === currentUserId || 
                           d.donorId === currentUserId))
      );
      if (!isMyDonation) return false;

      // 2. Filter by category
      const cat = d.category || d.Category;
      const id = d.categoryId || d.CategoryId || cat?.id || cat?.Id || cat?.ID || '';
      const name = d.categoryName || d.CategoryName || cat?.name || cat?.Name || '';
      // Match by ID first, then by name (for cases where ID wasn't available)
      return id === this.searchCategoryId
        || name === this.searchCategoryId
        || this.normalizeArabic(name) === this.normalizeArabic(this.searchCategoryId);
    });
    if (this.searchDateFrom) {
      const from = new Date(this.searchDateFrom);
      from.setHours(0, 0, 0, 0);
      results = results.filter(d => new Date(d.createdAt) >= from);
    }
    if (this.searchDateTo) {
      const to = new Date(this.searchDateTo);
      to.setHours(23, 59, 59, 999);
      results = results.filter(d => new Date(d.createdAt) <= to);
    }
    this.categorySearchResults = results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  clearSearch(): void {
    this.searchCategoryId = '';
    this.searchDateFrom = '';
    this.searchDateTo = '';
    this.categorySearchResults = [];
    this.cancelEdit();
  }

  getCategorySearchTotal(): number {
    return this.categorySearchResults.reduce((sum, d) => sum + (d.amount || 0), 0);
  }

  saveEditSearch(d: any): void {
    if (!this.editAmount || this.editAmount <= 0) return;
    this.api.updateDonation(d.id, { categoryId: d.categoryId, amount: this.editAmount }).subscribe({
      next: () => {
        this.toast.success('تم التعديل بنجاح ✅');
        this.editingId = null;
        this.loadHistory();
        // Re-run search after reload
        setTimeout(() => this.runCategorySearch(), 600);
      },
      error: () => this.toast.error('حدث خطأ أثناء التعديل')
    });
  }

  deleteSearchEntry(d: any): void {
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
            setTimeout(() => this.runCategorySearch(), 600);
          },
          error: () => this.toast.error('حدث خطأ أثناء الحذف')
        });
      }
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

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
    const targetId = d.targetUserId || d.assignedUserId || d.recipientId || d.userId ||
                     d.TargetUserId || d.AssignedUserId || d.RecipientId;
    if (!targetId) return '—';
    const admin = this.financialAdmins.find(a => a.id === targetId || a.userId === targetId);
    if (admin) return admin.fullName || admin.userName;
    if (targetId === this.auth.currentUser()?.userId) return this.auth.currentUser()?.fullName || 'أنا';
    return 'مسؤول مالي';
  }

  private normalizeArabic(str: string): string {
    if (!str) return '';
    return str.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim().toLowerCase();
  }

  private getWeekRangeLabel(date: Date): { label: string, start: Date, end: Date } {
    const d = new Date(date);
    const day = d.getDay();
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

  ngOnDestroy(): void {}
}
