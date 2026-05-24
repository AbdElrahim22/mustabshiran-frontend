import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { PartnerCharity, PartnerCharityDto } from '../../../core/models/models';
import { ToastService } from '../../../core/services/toast.service';
import { ExportService } from '../../../core/services/export.service';

@Component({
  selector: 'app-partners',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="page-header">
    <h2>الجمعيات الشريكة</h2>
    <div class="header-actions" style="display:flex; gap:10px; align-items:center;">
      <input type="text" [(ngModel)]="searchText" (ngModelChange)="onSearch()" placeholder="🔍 بحث عن جمعية..." style="padding:8px 12px; border-radius:6px; border:1px solid var(--border); background:var(--bg-dark); color:var(--text-primary); outline:none;">
      <button class="btn btn-primary" (click)="openAdd()">+ إضافة جمعية</button>
    </div>
  </div>

  @if (loading) { <div class="spinner"></div> }

  <div class="partners-grid" id="exportable-partners">
    @for (p of pagedPartners; track p.id) {
      <div class="partner-card">
        <div class="partner-logo">🤝</div>
        <div class="partner-info">
          <h3>{{ p.name }}</h3>
          <p>{{ p.contactPerson || 'لا يوجد مسؤول محدد' }}</p>
          <p>📞 {{ p.phoneNumber || '—' }}</p>
        </div>
        <div class="partner-actions">
          <button class="btn-icon" (click)="openEdit(p)">✏️</button>
          <button class="btn-icon danger" (click)="delete(p.id)">🗑️</button>
        </div>
      </div>
    }
  </div>

  <!-- Pagination -->
  @if (totalPages > 1) {
    <div style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 2rem; flex-wrap: wrap;">
      <button (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 1"
        style="padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary); cursor: pointer;"
        [style.opacity]="currentPage === 1 ? '0.4' : '1'">‹ السابق</button>

      @for (p of [].constructor(totalPages); track $index) {
        <button (click)="goToPage($index + 1)"
          [style.background]="currentPage === $index + 1 ? 'var(--primary)' : 'var(--bg-dark)'"
          [style.color]="currentPage === $index + 1 ? '#fff' : 'var(--text-secondary)'"
          style="width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-weight: 600;">{{ $index + 1 }}</button>
      }

      <button (click)="goToPage(currentPage + 1)" [disabled]="currentPage === totalPages"
        style="padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary); cursor: pointer;"
        [style.opacity]="currentPage === totalPages ? '0.4' : '1'">التالي ›</button>

      <span style="color: var(--text-secondary); font-size: 0.85rem;">صفحة {{ currentPage }} من {{ totalPages }} | إجمالي {{ filteredPartners.length }} جمعية</span>
    </div>
  }

  @if (showModal) {
    <div class="modal-overlay">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <h2>{{ editingId ? 'تعديل الجمعية' : 'إضافة جمعية شريكة' }}</h2>
        <form (ngSubmit)="submit()">
          <div class="form-group"><label>اسم الجمعية</label><input type="text" [(ngModel)]="form.name" name="name" required /></div>
          <div class="form-group"><label>المسؤول</label><input type="text" [(ngModel)]="form.contactPerson" name="contactPerson" /></div>
          <div class="form-group">
            <label>رقم الهاتف</label>
            <input type="tel" [(ngModel)]="form.phoneNumber" name="phoneNumber" 
                   #phone="ngModel" required minlength="11" maxlength="11" pattern="^[0-9]*$" />
            @if (phone.invalid && (phone.dirty || phone.touched)) {
              <div class="error-text">يجب إدخال 11 رقم موبايل بشكل صحيح</div>
            }
          </div>
          <div class="form-group"><label>العنوان</label><input type="text" [(ngModel)]="form.address" name="address" /></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" (click)="showModal = false">إلغاء</button>
            <button type="submit" class="btn btn-primary" [disabled]="phone.invalid || !form.name">حفظ</button>
          </div>
        </form>
      </div>
    </div>
  }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; h2 { font-size: 1.4rem; font-weight: 700; } }
    .partners-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
    .partner-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; display: flex; gap: 1rem; align-items: flex-start; transition: var(--transition); &:hover { border-color: var(--primary); } }
    .partner-logo { font-size: 2.5rem; }
    .partner-info { flex: 1; h3 { margin-bottom: 0.25rem; } p { font-size: 0.85rem; color: var(--text-secondary); } }
    .partner-actions { display: flex; flex-direction: column; gap: 0.3rem; }
    .btn-icon { background: none; border: none; font-size: 1.1rem; cursor: pointer; padding: 0.3rem; border-radius: 6px; &:hover { background: rgba(255,255,255,0.1); } &.danger:hover { background: rgba(231,76,60,0.15); } }
    .modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem; }
    .error-text { color: #e74c3c; font-size: 0.75rem; margin-top: 0.25rem; font-weight: 500; }
  `]
})
export class PartnersComponent implements OnInit {
  partners: PartnerCharity[] = [];
  searchText = '';
  loading = true;
  showModal = false;
  editingId: string | null = null;
  form: PartnerCharityDto = { name: '', contactPerson: '', phoneNumber: '', logoUrl: '', address: '' };
  private toast = inject(ToastService);
  private exportService = inject(ExportService);

  currentPage = 1;
  readonly pageSize = 8;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getPartners().subscribe({ next: d => { this.partners = d; this.loading = false; } });
  }

  get filteredPartners() {
    const text = this.searchText.trim().toLowerCase();
    if (!text) return this.partners;
    return this.partners.filter(p => 
      p.name.toLowerCase().includes(text) || 
      (p.contactPerson && p.contactPerson.toLowerCase().includes(text)) ||
      (p.phoneNumber && p.phoneNumber.includes(text))
    );
  }

  get totalPages() { return Math.max(1, Math.ceil(this.filteredPartners.length / this.pageSize)); }
  get pagedPartners() {
    const p = Math.min(this.currentPage, this.totalPages);
    return this.filteredPartners.slice((p - 1) * this.pageSize, p * this.pageSize);
  }
  goToPage(p: number) { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  onSearch() { this.currentPage = 1; }

  openAdd(): void { this.editingId = null; this.form = { name: '', contactPerson: '', phoneNumber: '', logoUrl: '', address: '' }; this.showModal = true; }
  openEdit(p: PartnerCharity): void { this.editingId = p.id; this.form = { name: p.name, contactPerson: p.contactPerson, phoneNumber: p.phoneNumber, logoUrl: p.logoUrl, address: p.address }; this.showModal = true; }

  submit(): void {
    const isEdit = !!this.editingId;
    const obs = this.editingId ? this.api.updatePartner(this.editingId, this.form) : this.api.addPartner(this.form);
    obs.subscribe({
      next: (p) => {
        if (this.editingId) { const i = this.partners.findIndex(x => x.id === this.editingId); if (i > -1) this.partners[i] = p; }
        else this.partners.unshift(p);
        this.showModal = false;
        this.toast.success(isEdit ? 'تم التعديل بنجاح ✅' : 'تمت الإضافة بنجاح ✅');
      }
    });
  }

  delete(id: string): void {
    if (!confirm('هل أنت متأكد من الحذف نهائياً؟')) return;
    this.api.deletePartner(id).subscribe(() => {
      this.partners = this.partners.filter(p => p.id !== id);
      this.toast.success('تم الحذف بنجاح ✅');
    });
  }
}
