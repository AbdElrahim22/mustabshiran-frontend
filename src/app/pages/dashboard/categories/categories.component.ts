import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { DonationCategory } from '../../../core/models/models';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <div>
          <h2 class="section-title">إدارة بنود التبرع</h2>
          <p class="section-desc">إضافة وتعديل الأقسام الرئيسية للتبرعات</p>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="text" [(ngModel)]="searchText" (ngModelChange)="onSearch()" placeholder="🔍 بحث عن بند..." style="padding:8px 12px; border-radius:6px; border:1px solid var(--border); background:var(--bg-dark); color:var(--text-primary); outline:none;">
          <button class="btn btn-primary" (click)="openAddModal()">
            <span>➕</span> إضافة بند جديد
          </button>
        </div>
      </div>

      <div class="categories-grid">
        @for (cat of pagedCategories; track cat.id) {
          <div class="category-card">
            <div class="card-img" [innerHTML]="getCategoryIcon(cat.name)"></div>
            <div class="card-content">
              <h3>{{ cat.name }}</h3>
              <p>{{ cat.description || 'لا يوجد وصف' }}</p>
              <div class="card-stats">
                <span class="label">إجمالي التبرعات:</span>
                <span class="value">{{ cat.totalAmount.toLocaleString('ar-EG') }} ج.م</span>
              </div>
              <div class="card-actions">
                <button class="btn-action edit" (click)="editCategory(cat)">✏️ تعديل</button>
                <button class="btn-action delete" (click)="deleteCategory(cat.id)">🗑️ حذف</button>
              </div>
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

          <span style="color: var(--text-secondary); font-size: 0.85rem;">صفحة {{ currentPage }} من {{ totalPages }} | إجمالي {{ filteredCategories.length }} بند</span>
        </div>
      }

      <!-- Modal -->
      @if (showModal) {
        <div class="modal-backdrop">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ editingId ? 'تعديل بند' : 'إضافة بند جديد' }}</h3>
              <button class="close-btn" (click)="closeModal()">×</button>
            </div>
            <form (ngSubmit)="saveCategory()" #catForm="ngForm">
              <div class="form-group">
                <label>اسم البند *</label>
                <input type="text" name="name" [(ngModel)]="formModel.name" required placeholder="مثال: إطعام مسكين">
              </div>
              <div class="form-group">
                <label>الوصف</label>
                <textarea name="description" [(ngModel)]="formModel.description" rows="3" placeholder="وصف موجز لهذا البند"></textarea>
              </div>
              <div class="form-group">
                <label>رابط الصورة (اختياري)</label>
                <input type="text" name="imageUrl" [(ngModel)]="formModel.imageUrl" placeholder="/images/categories/example.png">
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline" (click)="closeModal()">إلغاء</button>
                <button type="submit" class="btn btn-primary" [disabled]="catForm.invalid || loading">
                   {{ loading ? 'جاري الحفظ...' : 'حفظ البيانات' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { animation: fadeIn 0.5s ease-out; }
    .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .section-title { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.25rem; }
    .section-desc { color: var(--text-secondary); font-size: 0.9rem; }

    .categories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
    .category-card { background: var(--bg-card); border-radius: 16px; overflow: hidden; border: 1px solid var(--border); transition: var(--transition); &:hover { transform: translateY(-5px); border-color: var(--accent); } }
    .card-img { 
      position: relative; 
      height: 70px; 
      display: flex;
      align-items: center; 
      justify-content: center;
      padding: 0.5rem;
      background: rgba(46,158,91,0.03);
      margin-bottom: 0.25rem;
      ::ng-deep svg { 
        width: 40px !important; 
        height: 40px !important; 
        max-width: 40px !important; 
        max-height: 40px !important; 
        transition: transform 0.3s; 
      }
      &:hover { ::ng-deep svg { transform: scale(1.1); } } 
    }
    .card-content { padding: 1.25rem; h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; } p { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1rem; height: 40px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; } }
    .card-stats { background: rgba(46,158,91,0.05); padding: 0.75rem; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; .label { font-size: 0.75rem; color: var(--text-secondary); } .value { font-weight: 700; color: var(--accent); } }
    
    .card-actions { 
      display: flex; gap: 10px; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05);
      .btn-action { 
        flex: 1; padding: 0.6rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px;
        &.edit { background: rgba(59, 130, 246, 0.1); color: #3b82f6; &:hover { background: rgba(59, 130, 246, 0.2); } }
        &.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; &:hover { background: rgba(239, 68, 68, 0.2); } }
      }
    }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s; }
    .modal-content { background: var(--bg-card); width: 100%; max-width: 500px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); padding: 2rem; position: relative; border: 1px solid var(--border); animation: slideUp 0.3s ease-out; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; h3 { font-size: 1.3rem; font-weight: 800; } .close-btn { background: none; border: none; font-size: 2rem; color: var(--text-secondary); cursor: pointer; &:hover { color: var(--accent); } } }
    .form-group { margin-bottom: 1.25rem; label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600; } input, textarea { width: 100%; padding: 0.75rem 1rem; border-radius: 10px; background: var(--bg-dark); border: 1px solid var(--border); color: var(--text-primary); font-family: inherit; transition: var(--transition); &:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 4px rgba(46,158,91,0.1); } } }
    .modal-footer { display: flex; gap: 1rem; margin-top: 2rem; }

    .btn-icon { width: 36px; height: 36px; border-radius: 10px; border: none; background: white; cursor: pointer; transition: 0.2s; &:hover { transform: scale(1.1); } &.btn-danger:hover { background: #fee2e2; } }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class CategoriesComponent implements OnInit {
  categories: DonationCategory[] = [];
  searchText = '';
  showModal = false;
  loading = false;
  editingId: string | null = null;
  formModel = { name: '', description: '', imageUrl: '' };

  private sanitizer = inject(DomSanitizer);
  private toast = inject(ToastService);

  constructor(private api: ApiService) { }

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.api.getCategories().subscribe({
      next: (list) => this.categories = list.filter(c => !c.isDeleted),
      error: () => this.toast.error('حدث خطأ في تحميل البيانات')
    });
  }

  currentPage = 1;
  readonly pageSize = 8;

  get filteredCategories() {
    const text = this.searchText.trim().toLowerCase();
    if (!text) return this.categories;
    return this.categories.filter(c =>
      c.name.toLowerCase().includes(text) ||
      (c.description && c.description.toLowerCase().includes(text))
    );
  }

  get totalPages() { return Math.max(1, Math.ceil(this.filteredCategories.length / this.pageSize)); }
  get pagedCategories() {
    const p = Math.min(this.currentPage, this.totalPages);
    return this.filteredCategories.slice((p - 1) * this.pageSize, p * this.pageSize);
  }
  goToPage(p: number) { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  onSearch() { this.currentPage = 1; }

  openAddModal(): void {
    this.editingId = null;
    this.formModel = { name: '', description: '', imageUrl: '' };
    this.showModal = true;
  }

  editCategory(cat: DonationCategory): void {
    this.editingId = cat.id;
    this.formModel = {
      name: cat.name,
      description: cat.description || '',
      imageUrl: cat.imageUrl || ''
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveCategory(): void {
    if (!this.formModel.name) return;
    this.loading = true;

    const req = this.editingId
      ? this.api.updateCategory(this.editingId, this.formModel)
      : this.api.addCategory(this.formModel);

    req.subscribe({
      next: () => {
        this.loadCategories();
        this.closeModal();
        this.loading = false;
        this.toast.success(this.editingId ? 'تم تعديل البند بنجاح ✅' : 'تم إضافة البند بنجاح ✅');
      },
      error: () => {
        this.toast.error('حدث خطأ في حفظ البيانات');
        this.loading = false;
      }
    });
  }

  deleteCategory(id: string): void {
    if (confirm('هل أنت متأكد من الحذف نهائياً؟')) {
      this.api.deleteCategory(id).subscribe({
        next: () => { this.loadCategories(); this.toast.success('تم حذف البند بنجاح ✅'); },
        error: () => this.toast.error('حدث خطأ في الحذف')
      });
    }
  }

  getCategoryIcon(name: string): SafeHtml {
    const n = name.toLowerCase();
    let svg = '';

    // ─── Roofs (بناء أسقف) ────────────────────────
    if (n.includes('سقف') || n.includes('أسقف')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 35H54V55C54 56.1046 53.1046 57 52 57H12C10.8954 57 10 56.1046 10 55V35Z" fill="#E5E7EB"/>
          <path d="M32 7L58 35H6L32 7Z" fill="#D97706" stroke="#B45309" stroke-width="2"/>
          <rect x="25" y="42" width="14" height="15" fill="#92400E"/>
          <circle cx="45" cy="42" r="3" fill="#9CA3AF"/>
        </svg>`;
    }

    // ─── Water (وصلات مياه) ────────────────────────
    else if (n.includes('مياه') || n.includes('وصلات')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 8C32 8 12 28 12 42C12 53.0457 20.9543 62 32 62C43.0457 62 52 53.0457 52 42C52 28 32 8 32 8Z" fill="#3B82F6"/>
          <path d="M26 40C26 40 22 44 22 48" stroke="white" stroke-width="3" stroke-linecap="round"/>
        </svg>`;
    }

    // ─── Mosque (إعمار مساجد) ──────────────────────
    else if (n.includes('إعمار مساجد')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="15" y="35" width="34" height="25" rx="2" fill="#2E8E5B"/>
          <path d="M15 35L32 15L49 35H15Z" fill="#287A4E"/>
          <path d="M32 5Q52 35 12 35" stroke="#2E8E5B" stroke-width="4" fill="none"/>
          <circle cx="32" cy="15" r="8" fill="#FACC15" fill-opacity="0.8"/>
          <rect x="28" y="45" width="8" height="15" rx="1" fill="#064E3B"/>
        </svg>`;
    }

    // ─── Mosque Foam (فوم مساجد) ──────────────────
    else if (n.includes('فوم')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="25" width="44" height="30" rx="4" fill="#60A5FA" fill-opacity="0.3"/>
          <rect x="10" y="25" width="44" height="10" rx="2" fill="#60A5FA"/>
          <rect x="15" y="40" width="34" height="2" fill="#3B82F6" fill-opacity="0.5"/>
          <rect x="15" y="46" width="34" height="2" fill="#3B82F6" fill-opacity="0.5"/>
          <rect x="15" y="52" width="34" height="2" fill="#3B82F6" fill-opacity="0.5"/>
        </svg>`;
    }

    // ─── Ramadan (شنط رمضان) ──────────────────────
    else if (n.includes('رمضان')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 25H52L56 58H8L12 25Z" fill="#F59E0B"/>
          <path d="M22 25V15C22 10 26 6 32 6C38 6 42 10 42 15V25" stroke="#D97706" stroke-width="4"/>
          <circle cx="32" cy="42" r="8" fill="#FEF3C7"/>
          <path d="M32 38C34 38 36 39.5 36 42C36 44.5 34 46 32 46C30 46 28 44.5 28 42C28 39.5 30 38 32 38Z" fill="#F59E0B"/>
        </svg>`;
    }

    // ─── Zakat (زكاة) ─────────────────────────────
    else if (n.includes('زكاة')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 25C15 15 25 10 32 10C39 10 49 15 49 25C49 45 42 55 32 55C22 55 15 45 15 25Z" fill="#22C55E"/>
          <path d="M32 10V5M15 25H10M49 25H54" stroke="#166534" stroke-width="3" stroke-linecap="round"/>
          <text x="32" y="38" fill="white" font-size="18" font-weight="900" text-anchor="middle" dominant-baseline="middle">$</text>
        </svg>`;
    }

    // ─── Tricycle (تروسيكل) ────────────────────────
    else if (n.includes('تروسيكل')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="20" width="35" height="25" rx="2" fill="#4B5563"/>
          <circle cx="15" cy="50" r="8" fill="#1F2937" stroke="#9CA3AF" stroke-width="2"/>
          <circle cx="40" cy="50" r="8" fill="#1F2937" stroke="#9CA3AF" stroke-width="2"/>
          <path d="M45 40L55 25H60V30L55 45H45V40Z" fill="#6B7280"/>
          <circle cx="55" cy="50" r="6" fill="#1F2937"/>
        </svg>`;
    }

    // ─── Piggy Bank (حصالات) ──────────────────────
    else if (n.includes('حصالات')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M45 15C55 15 60 25 60 35C60 45 50 55 32 55C14 55 4 45 4 35C4 25 9 15 19 15L45 15Z" fill="#FB7185"/>
          <circle cx="52" cy="28" r="3" fill="#E11D48"/>
          <rect x="25" y="10" width="14" height="4" rx="2" fill="#991B1B"/>
          <path d="M12 25C12 25 8 20 5 22" stroke="#FB7185" stroke-width="4" stroke-linecap="round"/>
        </svg>`;
    }

    // ─── Monthly (شهريه) ─────────────────────────
    else if (n.includes('شهريه')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="15" width="44" height="40" rx="4" fill="#DDD6FE"/>
          <rect x="10" y="15" width="44" height="12" rx="2" fill="#8B5CF6"/>
          <path d="M32 30C32 30 42 40 32 50C22 40 32 30 32 30Z" fill="#EC4899"/>
          <rect x="15" y="10" width="4" height="10" rx="1" fill="#4C1D95"/>
          <rect x="45" y="10" width="4" height="10" rx="1" fill="#4C1D95"/>
        </svg>`;
    }

    // ─── Open (مفتوح) ────────────────────────────
    else if (n.includes('مفتوح')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 20L32 10L54 20V50L32 60L10 50V20Z" fill="#94A3B8"/>
          <path d="M10 20L32 30L54 20" stroke="white" stroke-width="2"/>
          <path d="M32 30V60" stroke="white" stroke-width="2"/>
        </svg>`;
    }

    // ─── Endowment (وقف خيري) ────────────────────
    else if (n.includes('وقف')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 55V35" stroke="#92400E" stroke-width="8" stroke-linecap="round"/>
          <circle cx="32" cy="25" r="15" fill="#22C55E"/>
          <circle cx="22" cy="30" r="12" fill="#16A34A"/>
          <circle cx="42" cy="30" r="12" fill="#16A34A"/>
        </svg>`;
    }

    // ─── Feeding (إطعام) ──────────────────────────
    else if (n.includes('إطعام')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="35" r="25" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="2"/>
          <path d="M15 25C15 25 18 45 32 45C46 45 49 25 49 25" stroke="#E11D48" stroke-width="4" stroke-linecap="round"/>
          <rect x="30" y="15" width="4" height="20" rx="2" fill="#475569"/>
        </svg>`;
    }

    // ─── Quran (مدرسة قرآن) ───────────────────────
    else if (n.includes('قرآن') || n.includes('مدرسة')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 50C10 50 15 45 32 45C49 45 54 50 54 50V15C54 15 49 10 32 10C15 10 10 15 10 15V50Z" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
          <path d="M32 10V45" stroke="#D97706" stroke-width="2"/>
          <path d="M15 20H25M15 30H25M39 20H49M39 30H49" stroke="#92400E" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
    }

    // ─── Debts (غرامات) ───────────────────────────
    else if (n.includes('غرامات')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 10V54" stroke="#475569" stroke-width="4"/>
          <path d="M10 30L32 25L54 30" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
          <circle cx="10" cy="45" r="8" fill="#94A3B8"/>
          <circle cx="54" cy="45" r="8" fill="#94A3B8"/>
        </svg>`;
    }

    // ─── Rent (إيجار مؤسسة) ───────────────────────
    else if (n.includes('إيجار') || n.includes('ايجار')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 50V25L32 10L54 25V50" stroke="#3B82F6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="26" y="35" width="12" height="15" fill="#3B82F6"/>
          <circle cx="35" cy="42" r="1.5" fill="#fff"/>
          <rect x="18" y="28" width="6" height="6" fill="#93C5FD"/>
          <rect x="40" y="28" width="6" height="6" fill="#93C5FD"/>
          <circle cx="48" cy="40" r="8" fill="#FACC15"/>
          <text x="48" y="45" fill="#B45309" font-size="14" font-weight="bold" text-anchor="middle">$</text>
        </svg>`;
    }

    // ─── Sacrifice (أضحية/ذبح) ────────────────────
    else if (n.includes('أضحية') || n.includes('اضحيه') || n.includes('ذبح')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 35C10 35 5 25 15 25C20 25 20 35 15 35Z" fill="#9CA3AF"/>
          <path d="M49 35C54 35 59 25 49 25C44 25 44 35 49 35Z" fill="#9CA3AF"/>
          <rect x="20" y="20" width="24" height="30" rx="12" fill="#F3F4F6"/>
          <circle cx="26" cy="18" r="8" fill="#E5E7EB"/>
          <circle cx="38" cy="18" r="8" fill="#E5E7EB"/>
          <circle cx="32" cy="14" r="8" fill="#E5E7EB"/>
          <circle cx="26" cy="30" r="2" fill="#374151"/>
          <circle cx="38" cy="30" r="2" fill="#374151"/>
          <path d="M32 40l-3 4m3-4l3 4" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="32" cy="38" r="2" fill="#FCA5A5"/>
        </svg>`;
    }

    else {
      svg = `<svg viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    }

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
