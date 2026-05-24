import { Component, OnInit, effect, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { ToastService } from '../../../core/services/toast.service';
import { DashboardStats, RecentDonation, LiquidityUser } from '../../../core/models/models';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';

type ModalType = 'donations' | 'partners' | 'cases-all' | 'cases-pending' | 'cases-approved' | 'cases-rejected' | 'category-details' | 'personal-category-details' | 'personal-liquidity-details' | 'deductions-form' | 'transfer-form' | 'pending-finances' | null;

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  styles: [`
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    .svg-icon ::ng-deep svg {
      width: 45px !important;
      height: 45px !important;
      max-width: 45px !important;
      max-height: 45px !important;
    }
  `]
})
export class OverviewComponent implements OnInit {
  stats: DashboardStats | null = null;
  recentDonations: RecentDonation[] = [];
  loading = true;
  private sanitizer = inject(DomSanitizer);

  // Unified modal state
  modalType: ModalType = null;
  modalTitle = '';
  modalData: any[] = [];
  errorModal = '';
  loadingModal = false;
  showLiquidityModal = false;
  showTransferModal = false;

  // Transfer form
  transferForm = { fromUserId: '', toUserId: '', categoryId: '', amount: 0, notes: '' };
  transferring = false;
  financialAdmins: any[] = [];
  myTransfers: any[] = [];
  fromUserCategories: any[] = [];
  loadingFromCategories = false;

  // New Features State
  selectedCategories: string[] = [];
  availableCategories: string[] = [];
  showFilterDropdown = false;
  selectedCategoryName: string = '';
  targetUserCategories: any[] = [];
  loadingTargetCategories = false;
  expandedUserId: string | null = null;
  pendingFinances: any[] = [];
  loadingPendingFinances = false;

  // Helper
  sumTotal = (acc: number, d: any) => acc + (d.amount ?? 0);

  constructor(private api: ApiService, private signalR: SignalRService, public auth: AuthService, private toast: ToastService, private router: Router) {
    effect(() => {
      const d = this.signalR.lastDonation();
      if (d && this.stats) {

        if (this.auth.isRestrictedAdmin()) {
          // Restricted admin: re-fetch from API to get correct personal-only totals
          // (the API filters by userId so we always get the right numbers)
          this.api.getDashboardStats().subscribe(data => this.stats = data);
          this.api.getRecentDonations().subscribe(data => this.recentDonations = data);
        } else {
          // Full admin: fast manual update using the event data (global totals)
          const cat = this.stats.categoryTotals.find((c: any) => c.id === d.categoryId);
          if (cat) cat.totalAmount = d.newTotal;
          this.stats.totalDonations += d.amount;
          this.stats.donationsCount++;

          const newEntry: RecentDonation = {
            id: crypto.randomUUID(),
            amount: d.amount,
            createdAt: new Date().toISOString(),
            donorName: d.donorName,
            donorEmail: '',
            categoryName: cat?.name ?? ''
          };

          this.recentDonations.unshift(newEntry);
          if (this.recentDonations.length > 20) this.recentDonations.pop();

          if (this.modalType === 'donations') {
            this.modalData.unshift(newEntry);
            this.updateAvailableCategories();
          }
        }
      }
    });

    // Refresh stats when cases change to update the counts on cards
    effect(() => {
      const change = this.signalR.lastCaseChange();
      if (change) {
        this.api.getDashboardStats().subscribe(data => this.stats = data);

        // If a cases modal is open, refresh its data too so the list updates live
        if (this.modalType && this.modalType.startsWith('cases-')) {
          this.api.getCases().subscribe(data => {
            if (this.modalType === 'cases-pending') this.modalData = data.filter(c => c.status === 'Pending' || c.status == 0);
            else if (this.modalType === 'cases-approved') this.modalData = data.filter(c => c.status === 'Approved' || c.status == 2);
            else if (this.modalType === 'cases-rejected') this.modalData = data.filter(c => c.status === 'Rejected' || c.status == 3);
            else this.modalData = data;
          });
        }
      }
    });
  }

  ngOnInit(): void {
    this.loadDashboard();
    this.api.getRecentDonations().subscribe(data => this.recentDonations = data);
    // جلب المسؤولين الماليين للـ transfer form
    this.api.getFinancialAdmins().subscribe(data => this.financialAdmins = data);
    this.fetchPendingFinances();
  }

  navigateTo(path: string): void {
    this.router.navigate(['/dashboard', path]);
  }

  loadDashboard(): void {
    this.loading = true;
    this.api.getDashboardStats().subscribe({
      next: (data) => {
        this.stats = data;
        if (data.myTransfers) this.myTransfers = data.myTransfers;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
    this.fetchPendingFinances();
  }

  fetchPendingFinances(): void {
    this.loadingPendingFinances = true;
    this.api.getPendingDonations().subscribe({
      next: (data) => {
        this.pendingFinances = Array.isArray(data) ? data : (data as any)?.$values || [];
        this.loadingPendingFinances = false;
      },
      error: (err) => {
        this.loadingPendingFinances = false;
        console.error('Error fetching pending finances:', err);
      }
    });
  }

  activatePending(id: string): void {
    Swal.fire({
      title: 'تأكيد تفعيل المعاملة؟',
      text: 'سيتم إضافة المبلغ إلى عهدة المسؤول المالي وتحديث أرصدة البنود والسيولة بشكل رسمي!',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2dd4bf',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، قم بالتفعيل والترحيل ✅',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.activatePendingDonation(id).subscribe({
          next: (res) => {
            this.toast.success(res.message || 'تم التفعيل بنجاح ✅');
            this.refreshModalData();
            this.loadDashboard();
          },
          error: (err) => {
            this.toast.error(err.error?.message || 'حدث خطأ أثناء التفعيل');
          }
        });
      }
    });
  }

  openDeductionModal(): void {
    this.modalType = 'deductions-form';
    this.modalTitle = '💸 إضافة خصم جديد';
    this.deductionForm = {
      categoryId: this.stats?.categoryTotals?.[0]?.id || '',
      amount: null,
      targetUserId: this.auth.currentUser()?.userId || ''
    };
    this.onTargetUserChange();
  }

  onTargetUserChange(): void {
    if (!this.deductionForm.targetUserId) {
      this.targetUserCategories = [];
      return;
    }

    this.loadingTargetCategories = true;
    this.api.getUserStats(this.deductionForm.targetUserId).subscribe({
      next: (data) => {
        this.targetUserCategories = data;
        this.loadingTargetCategories = false;

        // Reset selected category if not in new list
        if (!data.find(c => c.id === this.deductionForm.categoryId)) {
          this.deductionForm.categoryId = '';
        }
      },
      error: () => {
        this.loadingTargetCategories = false;
        this.targetUserCategories = [];
      }
    });
  }

  // --- Financial Transfers Logic ---
  openTransferModal(): void {
    this.showTransferModal = true;
    this.transferForm = { fromUserId: '', toUserId: '', categoryId: '', amount: 0, notes: '' };
    this.fromUserCategories = [];
    this.loadingFromCategories = false;
    this.editingTransferId = null;
    
    this.api.getFinancialAdmins().subscribe(admins => {
      this.financialAdmins = admins;
    });
  }

  onFromUserChange(): void {
    if (!this.transferForm.fromUserId) {
      this.fromUserCategories = [];
      return;
    }

    this.loadingFromCategories = true;
    this.api.getUserStats(this.transferForm.fromUserId).subscribe({
      next: (data: any) => {
        this.fromUserCategories = data.filter((c: any) => c.totalAmount > 0);
        this.loadingFromCategories = false;
      },
      error: () => {
        this.loadingFromCategories = false;
        this.toast.error('فشل في جلب بنود المسؤول');
      }
    });
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
    this.editingTransferId = null;
  }

  getFromUserLiquidity(): number {
    return this.fromUserCategories.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  }

  getAdminLiquidity(adminId: string): string {
    if (!this.stats || !this.stats.personalLiquidityAllocations) return '0 ج.م';
    if (adminId === this.auth.currentUser()?.userId) {
      return this.formatCurrency(this.stats.personalLiquidity);
    }
    const alloc = this.stats.personalLiquidityAllocations.find(a => a.userId === adminId);
    return this.formatCurrency(alloc ? alloc.totalAmount : 0);
  }

  editingTransferId: string | null = null;

  getMaxAllowedTransferAmount(): number {
    let base = this.getFromUserLiquidity();
    if (this.editingTransferId) {
      const oldTransfer = this.myTransfers.find(t => t.id === this.editingTransferId);
      if (oldTransfer && oldTransfer.fromUserId === this.transferForm.fromUserId) {
        base += oldTransfer.amount;
      }
    }
    return base;
  }

  submitTransfer(): void {
    if (!this.transferForm.fromUserId || !this.transferForm.toUserId || this.transferForm.amount <= 0) {
      this.toast.error('يرجى ملء جميع الحقول المطلوبة بشكل صحيح');
      return;
    }

    if (this.transferForm.amount > this.getMaxAllowedTransferAmount()) {
      this.toast.error('رصيد المسؤول المُرسل غير كافٍ لإتمام عملية التحويل');
      return;
    }

    this.transferring = true;

    const proceedWithTransfer = () => {
      const fromId = this.transferForm.fromUserId;
      const toId = this.transferForm.toUserId;
      const totalToTransfer = this.transferForm.amount;
      const notes = this.transferForm.notes;

      const activeCategories = [...this.fromUserCategories]
        .filter(c => c.totalAmount > 0)
        .sort((a, b) => b.totalAmount - a.totalAmount);

      let remaining = totalToTransfer;
      const calls: { categoryId: string, amount: number }[] = [];

      for (const cat of activeCategories) {
        if (remaining <= 0) break;
        const toTransfer = Math.min(cat.totalAmount, remaining);
        if (toTransfer > 0) {
          calls.push({ categoryId: cat.id, amount: toTransfer });
          remaining -= toTransfer;
        }
      }

      if (remaining > 0) {
        this.toast.error('رصيد المسؤول في البنود لا يكفي لإتمام العملية كاملة');
        this.transferring = false;
        return;
      }

      const executeCall = (index: number) => {
        if (index >= calls.length) {
          this.transferring = false;
          this.toast.success(this.editingTransferId ? 'تم تعديل التحويل بنجاح ✅' : 'تم التحويل بنجاح ✅');
          this.closeTransferModal();
          this.loadDashboard();
          return;
        }

        const currentCall = calls[index];
        this.api.createFinancialTransfer({
          fromUserId: fromId,
          toUserId: toId,
          categoryId: currentCall.categoryId,
          amount: currentCall.amount,
          notes: notes || undefined
        }).subscribe({
          next: () => {
            executeCall(index + 1);
          },
          error: (err) => {
            this.transferring = false;
            this.toast.error('فشل في إتمام التحويل: ' + (err.error?.message || err.message));
            this.loadDashboard();
          }
        });
      };

      executeCall(0);
    };

    if (this.editingTransferId) {
      // First delete the old one
      this.api.deleteFinancialTransfer(this.editingTransferId).subscribe({
        next: () => {
          this.myTransfers = this.myTransfers.filter(t => t.id !== this.editingTransferId);
          proceedWithTransfer();
        },
        error: (err) => {
          this.transferring = false;
          this.toast.error('فشل في إلغاء التحويل السابق للتعديل: ' + (err.error?.message || err.message));
        }
      });
    } else {
      proceedWithTransfer();
    }
  }

  editTransfer(t: any): void {
    this.editingTransferId = t.id;
    this.transferForm = {
      fromUserId: t.fromUserId,
      toUserId: t.toUserId,
      amount: t.amount,
      categoryId: '',
      notes: t.notes || ''
    };
    this.onFromUserChange();
  }

  deleteTransfer(id: string): void {
    this.api.deleteFinancialTransfer(id).subscribe({
      next: () => {
        this.myTransfers = this.myTransfers.filter(t => t.id !== id);
        this.toast.success('تم حذف التحويل بنجاح ✅');
        this.api.getDashboardStats().subscribe(data => { this.stats = data; });
      }
    });
  }

  openModal(type: ModalType, title: string): void {
    this.modalType = type;
    this.modalTitle = title;
    this.modalData = [];
    this.selectedCategories = [];
    this.errorModal = '';
    this.loadingModal = true;
    this.showFilterDropdown = false;

    let obs$;
    switch (type) {
      case 'donations': obs$ = this.api.getAllDonations(); break;
      case 'category-details': obs$ = this.api.getAllDonations(); break;
      case 'partners': obs$ = this.api.getPartners(); break;
      case 'cases-all': obs$ = this.api.getCases(); break;
      case 'cases-pending': obs$ = this.api.getCases(); break;
      case 'cases-approved': obs$ = this.api.getCases(); break;
      case 'cases-rejected': obs$ = this.api.getCases(); break;
      case 'pending-finances': obs$ = this.api.getPendingDonations(); break;
      default: this.loadingModal = false; return;
    }

    obs$.subscribe({
      next: (data: any[]) => {
        if (type === 'cases-pending') data = data.filter(c => c.status === 'Pending' || c.status == 0);
        if (type === 'cases-approved') data = data.filter(c => c.status === 'Approved' || c.status == 2);
        if (type === 'cases-rejected') data = data.filter(c => c.status === 'Rejected' || c.status == 3);
        
        let rawData = data;
        if (rawData && (rawData as any).$values) {
          rawData = (rawData as any).$values;
        } else if (!Array.isArray(rawData)) {
          rawData = [];
        }
        
        this.modalData = rawData;
        if (type === 'donations' || type === 'category-details') {
          this.updateAvailableCategories();
        }
        this.loadingModal = false;
      },
      error: (err) => {
        this.errorModal = 'تعذّر تحميل البيانات — تأكد أن الباك إند يعمل';
        this.loadingModal = false;
        console.error(err);
      }
    });
  }

  openPersonalModal(categoryName: string): void {
    this.modalType = 'personal-category-details';
    this.selectedCategoryName = categoryName;
    this.modalTitle = `تفاصيل تبرعاتي الشخصية لـ ${categoryName}`;
    this.modalData = [];
    this.errorModal = '';
    this.loadingModal = true;
    this.showFilterDropdown = false;

    this.api.getAllDonations().subscribe({
      next: (data: any[]) => {
        const userId = this.auth.currentUser()?.userId;
        this.modalData = data.filter(d => d.createdByUserId === userId && d.categoryName === categoryName);
        this.loadingModal = false;
      },
      error: (err) => {
        this.errorModal = 'تعذّر تحميل البيانات';
        this.loadingModal = false;
        console.error(err);
      }
    });
  }

  openPersonalLiquidityModal(): void {
    this.modalType = 'personal-liquidity-details';
    this.modalTitle = '💰 تفاصيل سيولتي الشخصية (المبالغ التي بعهدتك)';
    this.modalData = [];
    this.errorModal = '';
    this.loadingModal = true;
    this.showFilterDropdown = false;

    this.api.getAllDonations().subscribe({
      next: (data: any[]) => {
        const userId = this.auth.currentUser()?.userId;
        // Filter by UserId (who holds it) and optionally CreatedByUserId (to show personal additions)
        this.modalData = data.filter(d => d.userId === userId);
        this.loadingModal = false;
      },
      error: (err) => {
        this.errorModal = 'تعذّر تحميل البيانات';
        this.loadingModal = false;
        console.error(err);
      }
    });
  }

  updateAvailableCategories(): void {
    const cats = this.modalData.map(d => d.categoryName);
    this.availableCategories = [...new Set(cats)].filter(c => !!c);
  }

  toggleCategory(cat: string): void {
    const index = this.selectedCategories.indexOf(cat);
    if (index > -1) {
      this.selectedCategories.splice(index, 1);
    } else {
      this.selectedCategories.push(cat);
    }
  }

  get filteredModalData(): any[] {
    if (this.modalType === 'category-details') {
      let data = this.modalData.filter(d => d.categoryName === this.selectedCategoryName);
      if (this.showDeductionsOnly) {
        data = data.filter(d => d.amount < 0);
      } else {
        data = data.filter(d => d.amount > 0);
      }
      return data;
    }
    if (this.selectedCategories.length === 0) return this.modalData;
    return this.modalData.filter(d => this.selectedCategories.includes(d.categoryName));
  }

  get groupedDonations(): any[] {
    const groups: { [key: string]: { categoryName: string, amount: number, count: number } } = {};
    this.filteredModalData.forEach(d => {
      if (!groups[d.categoryName]) {
        groups[d.categoryName] = { categoryName: d.categoryName, amount: 0, count: 0 };
      }
      groups[d.categoryName].amount += d.amount;
      groups[d.categoryName].count++;
    });
    return Object.values(groups).sort((a, b) => b.amount - a.amount);
  }

  exportExcel(): void {
    let dataToExport: any[] = [];
    let fileName = '';

    if (this.modalType === 'donations') {
      dataToExport = this.groupedDonations.map((d, i) => ({
        '#': i + 1,
        'المجال / البند': d.categoryName,
        'عدد التبرعات': d.count,
        'إجمالي المبلغ': d.amount
      }));
      fileName = `Mustabshira_Summary_${new Date().getTime()}`;
    } else if (this.modalType === 'category-details') {
      dataToExport = this.filteredModalData.map((d, i) => ({
        '#': i + 1,
        'المتبرع': d.donorName,
        'المبلغ': d.amount,
        'التاريخ والوقت': this.formatDate(d.createdAt)
      }));
      fileName = `Mustabshira_${this.selectedCategoryName}_${new Date().getTime()}`;
    } else if (this.modalType === 'personal-category-details' || this.modalType === 'personal-liquidity-details') {
      dataToExport = this.modalData.map((d, i) => ({
        '#': i + 1,
        'المبلغ': d.amount,
        'التاريخ والوقت': this.formatDate(d.createdAt)
      }));
      fileName = this.modalType === 'personal-category-details' 
        ? `Mustabshira_My_${this.selectedCategoryName}_${new Date().getTime()}`
        : `Mustabshira_My_Liquidity_${new Date().getTime()}`;
    }

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التبرعات');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  // Deduction logic
  deductionForm = { categoryId: '', amount: null as number | null, targetUserId: '' };
  submittingDeduction = false;
  showDeductionsOnly = false;
  editingRowId: string | null = null;
  inlineEditAmount: number | null = null;

  getTargetUserLiquidity(): number {
    return this.targetUserCategories.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  }

  isBalanceInsufficient(): boolean {
    return false; // 🚀 السماح بالسالب دائماً
  }

  submitDeduction(): void {
    if (!this.deductionForm.targetUserId || !this.deductionForm.amount || this.deductionForm.amount <= 0) return;

    if (this.isBalanceInsufficient()) {
      return;
    }

    this.submittingDeduction = true;

    // خصم من السيولة الإجمالية — مع خيار الخصم من بند معين
    this.api.addDeduction({
      amount: this.deductionForm.amount,
      targetUserId: this.deductionForm.targetUserId,
      categoryId: this.deductionForm.categoryId || undefined
    }).subscribe({
      next: (res) => {
        this.submittingDeduction = false;
        this.toast.success(res.message || 'تم الخصم من السيولة بنجاح ✅');
        this.closeModal();
        this.loadDashboard();
      },
      error: (err) => {
        this.submittingDeduction = false;
        this.toast.error('حدث خطأ أثناء الخصم: ' + (err.error?.message || err.message));
      }
    });
  }

  startEdit(id: string, amount: number): void {
    this.editingRowId = id;
    this.inlineEditAmount = Math.abs(amount); // show positive number for the UI
  }

  saveEdit(id: string): void {
    if (!this.inlineEditAmount || this.inlineEditAmount <= 0) return;

    if (this.modalType === 'pending-finances') {
      const donation = this.modalData.find(d => d.id === id);
      if (!donation) return;

      this.api.updateDonation(id, { categoryId: donation.categoryId || '00000000-0000-0000-0000-000000000000', amount: this.inlineEditAmount }).subscribe({
        next: () => {
          this.toast.success('تم التعديل بنجاح ✅');
          this.editingRowId = null;
          this.refreshModalData();
        },
        error: (err) => this.toast.error('حدث خطأ أثناء التعديل: ' + (err.error?.message || err.message))
      });
      return;
    }

    const catId = this.stats?.categoryTotals.find(c => c.name === this.selectedCategoryName)?.id;
    if (!catId) return;

    this.api.updateDonation(id, { categoryId: catId, amount: this.inlineEditAmount }).subscribe({
      next: () => {
        this.toast.success('تم التعديل بنجاح ✅');
        this.editingRowId = null;
        this.refreshModalData();
      },
      error: (err) => this.toast.error('حدث خطأ أثناء التعديل: ' + (err.error?.message || err.message))
    });
  }

  deleteDonationEntry(id: string): void {
    Swal.fire({
      title: 'حذف التبرع؟',
      text: 'هل أنت متأكد من الحذف نهائياً؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذف نهائياً',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        // 1. حذف فوري من الـ array المحلي — بدون flash للـ "لا توجد بيانات"
        this.modalData = this.modalData.filter(d => d.id !== id);

        // 2. إرسال طلب الحذف للـ Backend في الخلفية
        this.api.deleteDonation(id).subscribe({
          next: () => {
            this.toast.success('تم الحذف بنجاح ✅');
            // تحديث صامت في الخلفية لضمان التزامن مع السيرفر
            this.refreshModalData();
          },
          error: (err) => {
            // لو الحذف فشل — نرجع العنصر للـ array (rollback)
            this.toast.error('حدث خطأ أثناء الحذف: ' + (err.error?.message || err.message));
            this.refreshModalData(); // restore from server
          }
        });
      }
    });
  }

  refreshModalData(): void {
    if (this.modalType === 'pending-finances') {
      this.api.getPendingDonations().subscribe(data => {
        let rawData = data;
        if (rawData && (rawData as any).$values) {
          rawData = (rawData as any).$values;
        } else if (!Array.isArray(rawData)) {
          rawData = [];
        }
        this.modalData = rawData;
        this.fetchPendingFinances();
      });
      return;
    }

    this.api.getAllDonations().subscribe(data => {
      if (this.modalType === 'personal-category-details') {
        const userId = this.auth.currentUser()?.userId;
        this.modalData = data.filter(d => d.createdByUserId === userId && d.categoryName === this.selectedCategoryName);
      } else if (this.modalType === 'personal-liquidity-details') {
        const userId = this.auth.currentUser()?.userId;
        this.modalData = data.filter(d => d.userId === userId);
      } else {
        this.modalData = data;
        this.updateAvailableCategories(); // update the arrays used by filters
      }
    });
  }

  exportPDF(): void {
    const tableId = this.modalType === 'category-details' ? 'detailsTable' :
      (this.modalType === 'personal-category-details' || this.modalType === 'personal-liquidity-details' ? 'personalDetailsTable' : 'donationsTable');
    const data = document.getElementById(tableId);
    if (!data) return;

    html2canvas(data, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        const clonedTable = clonedDoc.getElementById(tableId);
        if (clonedTable) {
          clonedTable.style.color = '#000000';
          const cells = clonedTable.querySelectorAll('td, th, strong, span');
          cells.forEach((cell: any) => {
            cell.style.color = '#000000';
            cell.style.borderColor = '#dddddd';
            if (cell.classList.contains('amount-cell')) {
              cell.style.color = '#d97706';
              cell.style.fontWeight = '800';
            }
          });
          const header = clonedTable.querySelector('thead tr');
          if (header) (header as HTMLElement).style.backgroundColor = '#f8fafc';
        }
      }
    }).then(canvas => {
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const contentDataURL = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(contentDataURL, 'PNG', 10, 10, imgWidth, imgHeight);
      let name = 'Summary';
      if (this.modalType === 'category-details') name = this.selectedCategoryName;
      if (this.modalType === 'personal-category-details') name = `My_${this.selectedCategoryName}`;
      pdf.save(`Mustabshira_${name}_${new Date().getTime()}.pdf`);
    });
  }

  closeModal(): void {
    this.modalType = null;
    this.showDeductionsOnly = false;
    this.deductionForm = { categoryId: this.stats?.categoryTotals?.[0]?.id || '', amount: null, targetUserId: this.auth.currentUser()?.userId || '' };
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

    // ─── Pending Finances (ماليات لم تصل) ─────────
    else if (n.includes('ماليات')) {
      svg = `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="28" fill="#14B8A6" fill-opacity="0.2"/>
          <rect x="18" y="24" width="28" height="20" rx="3" fill="#0D9488"/>
          <path d="M40 34H46V28H40V34Z" fill="#2DD4BF"/>
          <circle cx="32" cy="32" r="20" stroke="#0F766E" stroke-dasharray="4 2" stroke-width="2" fill="none"/>
          <path d="M32 18V32L40 36" stroke="#2DD4BF" stroke-width="3" stroke-linecap="round"/>
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

  caseStatusLabel(status: any): string {
    const map: Record<string, string> = {
      Pending: 'معلق', '0': 'معلق',
      UnderInvestigation: 'تحت الاستكشاف', '1': 'تحت الاستكشاف',
      Approved: 'معتمد', '2': 'معتمد',
      Rejected: 'مرفوض', '3': 'مرفوض',
      Closed: 'مغلق', '4': 'مغلق'
    };
    return map[status?.toString()] ?? status;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(amount);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('ar-EG');
  }
}
