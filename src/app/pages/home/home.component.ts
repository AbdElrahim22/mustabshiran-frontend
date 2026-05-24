import { Component, OnInit, OnDestroy, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { SignalRService } from '../../core/services/signalr.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { DonationCategory, InvestigationCase, CaseDto, CaseStatus } from '../../core/models/models';
import { ToastService } from '../../core/services/toast.service';

// @ts-ignore
import html2pdf from 'html2pdf.js';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private sanitizer = inject(DomSanitizer);
  cases: InvestigationCase[] = [];
  donationItems: DonationCategory[] = [];
  myDonations: any[] = [];
  loading = true;
  showModal = false;
  donationModal = false;
  editingCase: InvestigationCase | null = null;
  selectedCategory: DonationCategory | null = null;
  submitting = false;
  mobileMenuOpen = false;
  financialAdmins: any[] = [];
  searchQuery = '';

  // Date-based view state
  isDateModalOpen = false;
  viewDate: string | null = null;
  viewDateCases: InvestigationCase[] = [];
  private toast = inject(ToastService);

  form: CaseDto = {
    fullName: '',
    nationalId: '',
    familyMembersCount: null as any,
    region: '',
    phoneNumber: '',
    caseDetails: '',
    eligibility: '',
    requiredSupport: '',
    husbandName: '',
    husbandJob: '',
    childrenDetails: '',
    incomeSource: ''
  };
  selectedFiles: File[] = [];

  onFileSelected(event: any) {
    if (event.target.files) {
      const files = Array.from(event.target.files) as File[];
      this.selectedFiles = [...this.selectedFiles, ...files];
    }
    // Clear input so the same file can be selected again if removed
    event.target.value = '';
  }

  removeSelectedFile(file: File) {
    this.selectedFiles = this.selectedFiles.filter(f => f !== file);
  }
  donationForm = { amount: null as number | null, donorName: '', notes: '', assignedUserId: '', targetCategoryId: '' };

  constructor(
    public apiService: ApiService,
    public signalR: SignalRService,
    public authService: AuthService,
    public theme: ThemeService
  ) {
    effect(() => {
      const caseChange = this.signalR.lastCaseChange();
      if (caseChange && (this.authService.isAdmin() || this.authService.isUser())) {
        if (caseChange.action === 'added') {
          this.cases.unshift(caseChange.investigationCase);
        } else if (caseChange.action === 'updated') {
          const idx = this.cases.findIndex(c => c.id === caseChange.investigationCase.id);
          if (idx > -1) this.cases[idx] = caseChange.investigationCase;
        } else if (caseChange.action === 'deleted') {
          this.cases = this.cases.filter(c => c.id !== caseChange.caseId);
        }
      }

      const catChange = this.signalR.lastCategoryChange();
      if (catChange && this.authService.isAnyAdmin()) {
        const idx = this.donationItems.findIndex(c => c.id === catChange.id);
        if (idx > -1) {
          this.donationItems[idx].totalAmount = catChange.newTotal;
        }
      }
    });
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      if (this.authService.isAdmin() || this.authService.isUser()) {
        this.fetchCases();
      }
      
      // Always fetch categories for any admin to show donation grid
      if (this.authService.isAnyAdmin()) {
        this.fetchCategories();
        this.fetchMyDonations();
        this.fetchFinancialAdmins();
      }
    } else {
      this.loading = false;
    }
  }

  get groupedCases(): { date: string, cases: InvestigationCase[] }[] {
    const groups: { [key: string]: InvestigationCase[] } = {};
    
    this.cases.forEach(c => {
      const date = new Date(c.createdAt).toLocaleDateString('ar-EG');
      if (!groups[date]) groups[date] = [];
      groups[date].push(c);
    });

    return Object.keys(groups).map(date => ({
      date,
      cases: groups[date]
    })).sort((a, b) => {
      // Sort by date descending
      const dateA = new Date(a.cases[0].createdAt).getTime();
      const dateB = new Date(b.cases[0].createdAt).getTime();
      return dateB - dateA;
    });
  }

  openDateDetails(date: string): void {
    const group = this.groupedCases.find(g => g.date === date);
    if (group) {
      this.viewDate = date;
      this.viewDateCases = group.cases;
      this.isDateModalOpen = true;
    }
  }

  deleteDateGroup(date: string, event: Event): void {
    event.stopPropagation();
    if (!confirm(`هل أنت متأكد من الحذف نهائياً لجميع حالات يوم ${date}؟`)) return;
    
    const group = this.groupedCases.find(g => g.date === date);
    if (!group) return;

    // Delete all cases in the group
    const deleteObservables = group.cases.map(c => this.apiService.deleteCase(c.id));
    
    // We'll just run them and update local state
    let count = 0;
    deleteObservables.forEach(obs => {
      obs.subscribe({
        next: () => {
          count++;
          if (count === group.cases.length) {
            this.cases = this.cases.filter(c => !group.cases.some(gc => gc.id === c.id));
            if (this.viewDate === date) this.isDateModalOpen = false;
            this.toast.success('تم الحذف بنجاح ✅');
          }
        }
      });
    });
  }

  fetchCases(): void {
    this.loading = true;
    this.apiService.getCases().subscribe({
      next: (data) => { this.cases = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  fetchCategories(): void {
    this.loading = true;
    this.apiService.getCategories().subscribe({
      next: (data) => { 
        this.donationItems = data.filter(c => !c.isDeleted && !c.name.includes('سيول') && !c.name.includes('السيول')); 
        this.loading = false; 
      },
      error: () => { this.loading = false; }
    });
  }

  getFilteredCategories(): DonationCategory[] {
    if (!this.searchQuery.trim()) return this.donationItems;
    const query = this.normalizeArabic(this.searchQuery);
    return this.donationItems.filter(item => 
      this.normalizeArabic(item.name).includes(query)
    );
  }

  getPersonalCategoryTotal(catId: string): number {
    if (!this.myDonations) return 0;
    const currentUserId = this.authService.currentUser()?.userId;
    const targetName = this.normalizeArabic(this.donationItems.find(c => c.id === catId)?.name || '');
    
    return this.myDonations
      .filter(d => {
        // 1. Category Match
        const cat = d.category || (d as any).Category;
        const dId = cat?.id || cat?.ID || (d as any).categoryId || (d as any).CategoryId;
        const dName = this.normalizeArabic(cat?.name || cat?.Name || (d as any).categoryName || (d as any).CategoryName || '');
        const isCatMatch = dId === catId || (targetName && dName === targetName);
        
        // 2. Personal Ownership Match
        const dUserId = d.userId || d.UserId;
        const isMine = !dUserId || dUserId === currentUserId;

        // 3. Amount logic: positive is a contribution, negative is a deduction (only count if explicitly targeted to this category)
        const amount = Number(d.amount);
        if (amount > 0) {
          return isCatMatch && isMine;
        } else {
          const targetCatId = d.targetCategoryId || d.TargetCategoryId;
          return isCatMatch && isMine && targetCatId && String(targetCatId).toLowerCase() === String(catId).toLowerCase();
        }
      })
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }

  openDonation(cat: DonationCategory): void {
    this.selectedCategory = cat;
    this.donationForm = { amount: null, donorName: '', notes: '', assignedUserId: '', targetCategoryId: '' };
    this.donationModal = true;
    this.fetchMyDonations();
  }

  fetchMyDonations(): void {
    // Strictly personal history - only current user's donations
    this.apiService.getMyDonations().subscribe({
      next: (data: any) => { 
        const rawData = Array.isArray(data) ? data : (data?.$values || []);
        
        const now = Date.now();
        // Filter out any optimistic updates that are already represented in rawData OR are stale (>10s)
        const optimistic = this.myDonations.filter(d => {
          if (!String(d.id).startsWith('temp-')) return false;

          // 1. Fallback cleanup: remove if older than 10 seconds
          const timestamp = Number(String(d.id).split('-')[1]);
          if (now - timestamp > 10000) return false;

          // 2. Matching logic: check if server already returned this transaction
          const matchingReal = rawData.find((r: any) => {
            const rCatId = String(r.categoryId || r.Category?.id || r.Category?.Id || '').toLowerCase();
            const dCatId = String(d.categoryId || '').toLowerCase();
            const amountMatch = Math.abs(Number(r.amount || 0) - Number(d.amount || 0)) < 0.01;
            
            return rCatId === dCatId && amountMatch && !!rCatId;
          });
          
          // Keep the optimistic item ONLY if no matching real entry was found
          return !matchingReal;
        });

        this.myDonations = [...optimistic, ...rawData];
        
        // Final deduplication by ID just in case
        const seen = new Set();
        this.myDonations = this.myDonations.filter(d => {
          const id = d.id;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      },
      error: () => {}
    });
  }

  fetchFinancialAdmins(): void {
    this.apiService.getFinancialAdmins().subscribe(data => this.financialAdmins = data);
  }

  submitDonation(form?: NgForm): void {
    if (!this.selectedCategory) return;
    
    if (!this.donationForm.amount || this.donationForm.amount <= 0) {
      this.toast.error('يرجى إدخال مبلغ التبرع');
      return;
    }

    if (!this.donationForm.assignedUserId) {
      this.toast.error('يرجى اختيار المسؤول المالي أولاً لتأكيد التبرع');
      return;
    }

    const catName = this.selectedCategory.name || '';
    const isPending = catName === 'ماليات لم تصل';

    if (isPending && !this.donationForm.targetCategoryId) {
      this.toast.error('يرجى اختيار البند الفعلي أولاً لتأكيد التبرع');
      return;
    }

    this.submitting = true;
    const amount = this.donationForm.amount;
    const targetCat = { id: this.selectedCategory.id, name: this.selectedCategory.name };

    // Determine which category to actually send to. 
    // If it's a "Liquidity" donation, we might have selected a specific target category.
    const isLiquidity = catName.includes('سيول') || catName.includes('السيول');
    const actualCategoryId = (isLiquidity && this.donationForm.targetCategoryId) 
      ? this.donationForm.targetCategoryId 
      : targetCat.id;

    this.apiService.addDonation({
      categoryId: actualCategoryId,
      amount: amount,
      targetUserId: this.donationForm.assignedUserId || undefined,
      notes: this.donationForm.notes || undefined,
      targetCategoryId: isPending ? this.donationForm.targetCategoryId : undefined
    }).subscribe({
      next: (res) => {
        // Update the category total on the card (the one that was actually affected)
        const affectedCatId = actualCategoryId;
        const idx = this.donationItems.findIndex(c => c.id === affectedCatId);
        if (idx > -1) this.donationItems[idx].totalAmount = res.newTotal;
        
        // If it was a targeted liquidity donation, we should also update the "Liquidity" card total if it exists
        if (isLiquidity && affectedCatId !== targetCat.id) {
           // The backend logic handles the global totals, but for UI feedback:
           // Since the balance was added to a specific category for a specific user, 
           // the "Liquidity" card itself represents the aggregate of funds assigned to users.
        }

        // Reset the form amount
        if (form) {
          form.resetForm();
        } else {
          this.donationForm.amount = null;
          this.donationForm.assignedUserId = '';
          this.donationForm.targetCategoryId = '';
        }
        this.submitting = false;

        // Fetch the real list from server - no duplicates, no temp items
        this.fetchMyDonations();
        this.toast.success('تمت الإضافة بنجاح ✅');
      },
      error: () => { this.submitting = false; }
    });
  }

  getCategoryImg(cat: DonationCategory): string | null {
    // Force null for these to ensure SVG icons show instead of broken database URLs
    const n = cat.name.toLowerCase();
    if (n.includes('فوم') || n.includes('رمضان') || n.includes('إيجار') || n.includes('ايجار') || n.includes('أضحية') || n.includes('اضحيه') || n.includes('ذبح')) return null;
    return cat.imageUrl || null;
  }

  onImageError(event: any) {
    event.target.src = '/images/categories/open.png';
  }

  getCategoryIcon(name: string): SafeHtml {
    const n = name.toLowerCase();
    let svg = '';
    
    if (n.includes('سقف') || n.includes('أسقف')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 35H54V55C54 56.1046 53.1046 57 52 57H12C10.8954 57 10 56.1046 10 55V35Z" fill="#E5E7EB"/><path d="M32 7L58 35H6L32 7Z" fill="#D97706" stroke="#B45309" stroke-width="2"/><rect x="25" y="42" width="14" height="15" fill="#92400E"/><circle cx="45" cy="42" r="3" fill="#9CA3AF"/></svg>`;
    }
    else if (n.includes('مياه') || n.includes('وصلات')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M32 8C32 8 12 28 12 42C12 53.0457 20.9543 62 32 62C43.0457 62 52 53.0457 52 42C52 28 32 8 32 8Z" fill="#3B82F6"/><path d="M26 40C26 40 22 44 22 48" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>`;
    }
    else if (n.includes('سيوله') || n.includes('السيوله')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="28" fill="#FACC15" stroke="#EAB308" stroke-width="2"/><text x="32" y="38" fill="#854d0e" font-size="32" font-weight="900" text-anchor="middle">LE</text><path d="M32 12V18M32 46V52M12 32H18M46 32H52" stroke="#854d0e" stroke-width="4" stroke-linecap="round"/></svg>`;
    }
    else if (n.includes('إعمار مساجد') || n.includes('بناء مساجد')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="35" width="34" height="25" rx="2" fill="#2E8E5B"/><path d="M15 35L32 15L49 35H15Z" fill="#287A4E"/><path d="M32 5Q52 35 12 35" stroke="#2E8E5B" stroke-width="4" fill="none"/><circle cx="32" cy="15" r="8" fill="#FACC15" fill-opacity="0.8"/><rect x="28" y="45" width="8" height="15" rx="1" fill="#064E3B"/></svg>`;
    }
    else if (n.includes('فوم')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="25" width="44" height="30" rx="4" fill="#60A5FA" fill-opacity="0.3"/><rect x="10" y="25" width="44" height="10" rx="2" fill="#60A5FA"/><rect x="15" y="40" width="34" height="2" fill="#3B82F6" fill-opacity="0.5"/><rect x="15" y="46" width="34" height="2" fill="#3B82F6" fill-opacity="0.5"/><rect x="15" y="52" width="34" height="2" fill="#3B82F6" fill-opacity="0.5"/></svg>`;
    }
    else if (n.includes('رمضان')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 25H52L56 58H8L12 25Z" fill="#F59E0B"/><path d="M22 25V15C22 10 26 6 32 6C38 6 42 10 42 15V25" stroke="#D97706" stroke-width="4"/><circle cx="32" cy="42" r="8" fill="#FEF3C7"/><path d="M32 38C34 38 36 39.5 36 42C36 44.5 34 46 32 46C30 46 28 44.5 28 42C28 39.5 30 38 32 38Z" fill="#F59E0B"/></svg>`;
    }
    else if (n.includes('زكاة')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 25C15 15 25 10 32 10C39 10 49 15 49 25C49 45 42 55 32 55C22 55 15 45 15 25Z" fill="#22C55E"/><path d="M32 10V5M15 25H10M49 25H54" stroke="#166534" stroke-width="3" stroke-linecap="round"/><text x="32" y="38" fill="white" font-size="18" font-weight="900" text-anchor="middle" dominant-baseline="middle">$</text></svg>`;
    }
    else if (n.includes('تروسيكل')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="35" height="25" rx="2" fill="#4B5563"/><circle cx="15" cy="50" r="8" fill="#1F2937" stroke="#9CA3AF" stroke-width="2"/><circle cx="40" cy="50" r="8" fill="#1F2937" stroke="#9CA3AF" stroke-width="2"/><path d="M45 40L55 25H60V30L55 45H45V40Z" fill="#6B7280"/><circle cx="55" cy="50" r="6" fill="#1F2937"/></svg>`;
    }
    else if (n.includes('حصالات')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M45 15C55 15 60 25 60 35C60 45 50 55 32 55C14 55 4 45 4 35C4 25 9 15 19 15L45 15Z" fill="#FB7185"/><circle cx="52" cy="28" r="3" fill="#E11D48"/><rect x="25" y="10" width="14" height="4" rx="2" fill="#991B1B"/><path d="M12 25C12 25 8 20 5 22" stroke="#FB7185" stroke-width="4" stroke-linecap="round"/></svg>`;
    }
    else if (n.includes('شهريه')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="15" width="44" height="40" rx="4" fill="#DDD6FE"/><rect x="10" y="15" width="44" height="12" rx="2" fill="#8B5CF6"/><path d="M32 30C32 30 42 40 32 50C22 40 32 30 32 30Z" fill="#EC4899"/><rect x="15" y="10" width="4" height="10" rx="1" fill="#4C1D95"/><rect x="45" y="10" width="4" height="10" rx="1" fill="#4C1D95"/></svg>`;
    }
    else if (n.includes('مفتوح')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 20L32 10L54 20V50L32 60L10 50V20Z" fill="#94A3B8"/><path d="M10 20L32 30L54 20" stroke="white" stroke-width="2"/><path d="M32 30V60" stroke="white" stroke-width="2"/></svg>`;
    }
    else if (n.includes('وقف')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M32 55V35" stroke="#92400E" stroke-width="8" stroke-linecap="round"/><circle cx="32" cy="25" r="15" fill="#22C55E"/><circle cx="22" cy="30" r="12" fill="#16A34A"/><circle cx="42" cy="30" r="12" fill="#16A34A"/></svg>`;
    }
    else if (n.includes('إطعام')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="35" r="25" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="2"/><path d="M15 25C15 25 18 45 32 45C46 45 49 25 49 25" stroke="#E11D48" stroke-width="4" stroke-linecap="round"/><rect x="30" y="15" width="4" height="20" rx="2" fill="#475569"/></svg>`;
    }
    else if (n.includes('قرآن') || n.includes('مدرسة')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 50C10 50 15 45 32 45C49 45 54 50 54 50V15C54 15 49 10 32 10C15 10 10 15 10 15V50Z" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/><path d="M32 10V45" stroke="#D97706" stroke-width="2"/><path d="M15 20H25M15 30H25M39 20H49M39 30H49" stroke="#92400E" stroke-width="2" stroke-linecap="round"/></svg>`;
    }
    else if (n.includes('غرامات')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M32 10V54" stroke="#475569" stroke-width="4"/><path d="M10 30L32 25L54 30" stroke="#475569" stroke-width="4" stroke-linecap="round"/><circle cx="10" cy="45" r="8" fill="#94A3B8"/><circle cx="54" cy="45" r="8" fill="#94A3B8"/></svg>`;
    }
    else if (n.includes('إيجار') || n.includes('ايجار')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 50V25L32 10L54 25V50" stroke="#3B82F6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="26" y="35" width="12" height="15" fill="#3B82F6"/><circle cx="35" cy="42" r="1.5" fill="#fff"/><rect x="18" y="28" width="6" height="6" fill="#93C5FD"/><rect x="40" y="28" width="6" height="6" fill="#93C5FD"/><circle cx="48" cy="40" r="8" fill="#FACC15"/><text x="48" y="45" fill="#B45309" font-size="14" font-weight="bold" text-anchor="middle">$</text></svg>`;
    }
    else if (n.includes('أضحية') || n.includes('اضحيه') || n.includes('ذبح')) {
      svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 35C10 35 5 25 15 25C20 25 20 35 15 35Z" fill="#9CA3AF"/><path d="M49 35C54 35 59 25 49 25C44 25 44 35 49 35Z" fill="#9CA3AF"/><rect x="20" y="20" width="24" height="30" rx="12" fill="#F3F4F6"/><circle cx="26" cy="18" r="8" fill="#E5E7EB"/><circle cx="38" cy="18" r="8" fill="#E5E7EB"/><circle cx="32" cy="14" r="8" fill="#E5E7EB"/><circle cx="26" cy="30" r="2" fill="#374151"/><circle cx="38" cy="30" r="2" fill="#374151"/><path d="M32 40l-3 4m3-4l3 4" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="38" r="2" fill="#FCA5A5"/></svg>`;
    }
    else {
      svg = `<svg viewBox="0 0 24 24" fill="none" stroke="#2e9e5b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    }
    
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  formatDate(d: any): string {
    return new Date(d).toLocaleDateString('ar-EG');
  }

  statusLabel(s: CaseStatus): string {
    const map: any = { Pending: 'معلق', UnderInvestigation: 'تحت الاستكشاف', Approved: 'مقبول', Rejected: 'مرفوض', Closed: 'مغلق' };
    return map[s] || s;
  }

  statusClass(s: CaseStatus): string {
    const map: any = { Pending: 'warning', UnderInvestigation: 'primary', Approved: 'success', Rejected: 'danger', Closed: 'secondary' };
    return `badge badge-${map[s] || 'primary'}`;
  }

  submit(): void {
    if (!this.form.fullName) return;
    this.submitting = true;

    const formData = new FormData();
    Object.keys(this.form).forEach(key => {
      const val = (this.form as any)[key];
      if (val !== null && val !== undefined) {
        formData.append(key, val.toString());
      }
    });

    if (this.selectedFiles && this.selectedFiles.length > 0) {
      this.selectedFiles.forEach(file => {
        formData.append('Images', file, file.name);
      });
    }

    const obs = this.editingCase ? this.apiService.updateCase(this.editingCase.id, formData) : this.apiService.addCase(formData);
    obs.subscribe({
      next: (res) => { 
        this.showModal = false; 
        this.submitting = false; 
        if (!this.editingCase) {
          this.fetchCases(); 
        } else {
          // If we were viewing date details, update the item in the list too
          const idx = this.viewDateCases.findIndex(c => c.id === this.editingCase?.id);
          if (idx > -1) this.viewDateCases[idx] = res;
        }
        this.toast.success(this.editingCase ? 'تم التعديل بنجاح ✅' : 'تمت الإضافة بنجاح ✅');
      },
      error: () => { this.submitting = false; }
    });
  }

  openAdd(): void {
    this.editingCase = null;
    this.form = {
      fullName: '',
      nationalId: '',
      familyMembersCount: null as any,
      region: '',
      phoneNumber: '',
      caseDetails: '',
      eligibility: '',
      requiredSupport: '',
      husbandName: '',
      husbandJob: '',
      childrenDetails: '',
      incomeSource: ''
    };
    this.selectedFiles = [];
    this.showModal = true;
  }

  openEdit(c: InvestigationCase): void {
    this.editingCase = c;
    this.form = { 
      fullName: c.fullName, 
      nationalId: c.nationalId, 
      familyMembersCount: c.familyMembersCount, 
      phoneNumber: c.phoneNumber, 
      address: c.address, 
      region: c.region || c.address || '',
      caseDetails: c.caseDetails, 
      eligibility: c.eligibility,
      requiredSupport: c.requiredSupport, 
      husbandName: c.husbandName, 
      husbandJob: c.husbandJob, 
      childrenDetails: c.childrenDetails, 
      incomeSource: c.incomeSource 
    };
    this.selectedFiles = [];
    this.showModal = true;
  }

  private normalizeArabic(str: string): string {
    if (!str) return '';
    let result = str
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .trim()
      .toLowerCase();
    
    // Remove "al-" prefix if exists to match "سيولة" with "السيولة"
    if (result.startsWith('ال')) {
      result = result.substring(2);
    }
    return result;
  }

  getFilteredDonations(): any[] {
    if (!this.selectedCategory || !this.myDonations) return [];
    const targetId = this.selectedCategory.id;
    const targetName = this.normalizeArabic(this.selectedCategory.name);

    return this.myDonations
      .filter(d => {
        const cat = d.category || (d as any).Category;
        const dId = cat?.id || cat?.Id || cat?.ID || d.categoryId || d.CategoryId || (d as any).categoryId || (d as any).CategoryId;
        const dName = this.normalizeArabic(cat?.name || cat?.Name || (d as any).categoryName || (d as any).CategoryName || '');
        
        return dId === targetId || (dName && targetName && dName === targetName);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }

  delete(id: string): void {
    if (!confirm('هل أنت متأكد من الحذف نهائياً؟')) return;
    this.apiService.deleteCase(id).subscribe({
      next: () => { 
        this.cases = this.cases.filter(c => c.id !== id); 
        this.viewDateCases = this.viewDateCases.filter(c => c.id !== id);
        if (this.viewDateCases.length === 0) this.isDateModalOpen = false;
        this.toast.success('تم الحذف بنجاح ✅');
      }
    });
  }

  getAllFilteredDonations(): any[] {
    if (!this.selectedCategory || !this.myDonations) return [];
    const targetId = this.selectedCategory.id;
    const targetName = this.normalizeArabic(this.selectedCategory.name);

    return this.myDonations
      .filter(d => {
        const cat = d.category || (d as any).Category;
        const dId = cat?.id || cat?.Id || cat?.ID || d.categoryId || d.CategoryId || (d as any).categoryId || (d as any).CategoryId;
        const dName = this.normalizeArabic(cat?.name || cat?.Name || (d as any).categoryName || (d as any).CategoryName || '');
        
        return dId === targetId || (dName && targetName && dName === targetName);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  downloadCategoriesPDF(): void {
    const totalSum = this.donationItems.reduce((sum, item) => sum + (this.getPersonalCategoryTotal(item.id) || 0), 0);
    const dateStr = new Date().toLocaleString('ar-EG');

    const element = document.createElement('div');
    element.style.direction = 'rtl';
    element.style.fontFamily = 'Cairo, system-ui, sans-serif';
    element.style.padding = '30px';
    element.style.background = '#ffffff';
    element.style.color = '#1e293b';

    element.innerHTML = `
      <div style="border-bottom: 3px solid #818cf8; padding-bottom: 20px; margin-bottom: 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="color: #4f46e5; margin: 0; font-size: 1.8rem; font-weight: 800; font-family: Cairo, sans-serif;">جمعية مستبشرا الخيرية</h1>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 0.95rem; font-family: Cairo, sans-serif;">تقرير الأرصدة الإجمالية لبنود التبرعات</p>
          </div>
          <div style="text-align: left;">
            <span style="font-size: 2.5rem; color: #4f46e5;">☪</span>
          </div>
        </div>
        <div style="margin-top: 15px; font-size: 0.85rem; color: #94a3b8; display: flex; justify-content: space-between; font-family: Cairo, sans-serif;">
          <span>تاريخ الإصدار: ${dateStr}</span>
          <span>الحالة: معتمد</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; font-family: Cairo, sans-serif;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; text-align: center;">
          <span style="display: block; color: #64748b; font-size: 0.85rem; margin-bottom: 5px;">إجمالي عدد البنود النشطة</span>
          <strong style="color: #1e293b; font-size: 1.5rem; font-weight: 800;">${this.donationItems.length} بنود</strong>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 15px; text-align: center;">
          <span style="display: block; color: #1e40af; font-size: 0.85rem; margin-bottom: 5px;">إجمالي أرصدة البنود</span>
          <strong style="color: #1d4ed8; font-size: 1.5rem; font-weight: 800;">${totalSum.toLocaleString('ar-EG')} ج.م</strong>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: Cairo, sans-serif;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; color: #475569; font-weight: bold;">م</th>
            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; color: #475569; font-weight: bold;">اسم البند / المشروع</th>
            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: left; color: #475569; font-weight: bold;">الرصيد الحالي (ج.م)</th>
          </tr>
        </thead>
        <tbody>
          ${this.donationItems.map((item, idx) => `
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center; color: #64748b;">${idx + 1}</td>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: right; font-weight: 700; color: #1e293b;">${item.name}</td>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-weight: 800; color: #10b981; direction: ltr;">${(this.getPersonalCategoryTotal(item.id) || 0).toLocaleString('ar-EG')} ج.م</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px; font-size: 0.8rem; color: #94a3b8; font-family: Cairo, sans-serif;">
        جمعية مستبشرا الخيرية — نعمل من أجل وجه الله تعالى
      </div>
    `;

    const opt = {
      margin:       0.4,
      filename:     `تقرير_البنود_${new Date().getTime()}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  }

  downloadCategoryMyOperationsPDF(): void {
    if (!this.selectedCategory) return;
    const ops = this.getAllFilteredDonations();
    const totalSum = ops.reduce((sum, d) => sum + (d.amount || 0), 0);
    const dateStr = new Date().toLocaleString('ar-EG');
    const userName = this.authService.currentUser()?.fullName || 'المسؤول المالي';

    const element = document.createElement('div');
    element.style.direction = 'rtl';
    element.style.fontFamily = 'Cairo, system-ui, sans-serif';
    element.style.padding = '30px';
    element.style.background = '#ffffff';
    element.style.color = '#1e293b';

    element.innerHTML = `
      <div style="border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="color: #d97706; margin: 0; font-size: 1.8rem; font-weight: 800; font-family: Cairo, sans-serif;">تقرير العمليات الشخصية</h1>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 0.95rem; font-family: Cairo, sans-serif;">بند: ${this.selectedCategory.name}</p>
          </div>
          <div style="text-align: left;">
            <span style="font-size: 2.5rem; color: #f59e0b;">☪</span>
          </div>
        </div>
        <div style="margin-top: 15px; font-size: 0.85rem; color: #94a3b8; display: flex; justify-content: space-between; font-family: Cairo, sans-serif;">
          <span>المسؤول: ${userName}</span>
          <span>تاريخ التقرير: ${dateStr}</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; font-family: Cairo, sans-serif;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; text-align: center;">
          <span style="display: block; color: #64748b; font-size: 0.85rem; margin-bottom: 5px;">عدد العمليات المسجلة</span>
          <strong style="color: #1e293b; font-size: 1.5rem; font-weight: 800;">${ops.length} عمليات</strong>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 15px; text-align: center;">
          <span style="display: block; color: #b45309; font-size: 0.85rem; margin-bottom: 5px;">إجمالي المبالغ المضافة</span>
          <strong style="color: #d97706; font-size: 1.5rem; font-weight: 800;">${totalSum.toLocaleString('ar-EG')} ج.م</strong>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: Cairo, sans-serif;">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; color: #475569; font-weight: bold;">م</th>
            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; color: #475569; font-weight: bold;">المبلغ</th>
            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; color: #475569; font-weight: bold;">التاريخ والوقت</th>
            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; color: #475569; font-weight: bold;">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${ops.map((d, idx) => `
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center; color: #64748b;">${idx + 1}</td>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: right; font-weight: 800; color: #10b981; direction: ltr;">+ ${(d.amount || 0).toLocaleString('ar-EG')} ج.م</td>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: right; color: #1e293b;">${this.formatDate(d.createdAt)}</td>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: right; color: #64748b; font-style: italic;">${d.notes || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px; font-size: 0.8rem; color: #94a3b8; font-family: Cairo, sans-serif;">
        جمعية مستبشرا الخيرية — نعمل من أجل وجه الله تعالى
      </div>
    `;

    const opt = {
      margin:       0.4,
      filename:     `عملياتي_${this.selectedCategory.name}_${new Date().getTime()}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  }

  ngOnDestroy(): void {}
}
