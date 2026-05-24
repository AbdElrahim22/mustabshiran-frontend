import { Component, OnInit, effect, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { InvestigationCase, CaseDto, CaseStatus } from '../../../core/models/models';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ExportService } from '../../../core/services/export.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cases',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cases.component.html',
  styleUrl: './cases.component.scss'
})
export class CasesComponent implements OnInit {
  cases = signal<InvestigationCase[]>([]);
  loading = true;
  showModal = false;
  editingCase: InvestigationCase | null = null;
  submitting = false;

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
  searchText = signal<string>('');
  private exportService = inject(ExportService);

  exportExcel() { this.exportService.exportToExcel('exportable-cases', 'حالات_الاستكشاف'); }
  exportPdf() { this.exportService.exportToPdf('exportable-cases', 'حالات_الاستكشاف'); }

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
  private toast = inject(ToastService);

  statuses: { value: CaseStatus; label: string }[] = [
    { value: 'Pending', label: 'معلق' },
    { value: 'Approved', label: 'معتمد' },
    { value: 'Rejected', label: 'مرفوض' }
  ];

  isAdmin = computed(() => this.auth.isAdmin());
  userRole = computed(() => this.auth.currentUser()?.role || 'No Role');

  constructor(private api: ApiService, private signalR: SignalRService, public auth: AuthService) {
    effect(() => {
      const change = this.signalR.lastCaseChange();
      if (!change) return;
      if (change.action === 'added') {
        this.cases.update(prev => {
          if (prev.some(c => c.id === change.investigationCase.id)) return prev;
          return [change.investigationCase, ...prev];
        });
      } else if (change.action === 'updated') {
        this.cases.update(prev => prev.map(c => c.id === change.investigationCase.id ? change.investigationCase : c));
      } else if (change.action === 'statusUpdated') {
        this.cases.update(prev => prev.map(c => c.id === change.caseId ? { ...c, status: change.newStatus } : c));
      } else if (change.action === 'deleted') {
        this.cases.update(prev => prev.filter(c => c.id !== change.caseId));
      } else if (change.action === 'cleared') {
        this.cases.set([]);
      }
    });
  }

  getImgUrl(img: string): string {
    if (!img) return '';
    if (img.startsWith('http')) return img;
    const base = environment.apiUrl.replace('/api', '');
    return `${base}${img.startsWith('/') ? img : '/' + img}`;
  }

  ngOnInit(): void {
    this.api.getCases().subscribe({ next: d => { this.cases.set(d); this.loading = false; } });
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

  submit(): void {
    if (!this.form.fullName) return;
    this.submitting = true;
    const isEdit = !!this.editingCase;

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

    const obs = isEdit ? this.api.updateCase(this.editingCase!.id, formData) : this.api.addCase(formData);
    obs.subscribe({ 
      next: () => { 
        this.showModal = false; 
        this.submitting = false; 
        this.toast.success(isEdit ? 'تم التعديل بنجاح ✅' : 'تمت الإضافة بنجاح ✅');
      }, 
      error: () => { this.submitting = false; } 
    });
  }

  updateStatus(id: string, status: CaseStatus): void {
    this.api.updateCaseStatus(id, status).subscribe(() => this.toast.success('تم تغيير الحالة بنجاح ✅'));
  }

  delete(id: string): void {
    Swal.fire({
      title: 'حذف الحالة؟',
      text: "هل أنت متأكد من الحذف نهائياً؟",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذفها',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.deleteCase(id).subscribe(() => this.toast.success('تم الحذف بنجاح ✅'));
      }
    });
  }

  deleteAll(): void {
    Swal.fire({
      title: 'حذف جميع الحالات؟',
      text: "هل أنت متأكد من حذف جميع الحالات نهائياً؟ لا يمكن التراجع عن هذه العملية.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذف الكل',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.deleteAllCases().subscribe({
          next: () => {
            Swal.fire({
              title: 'تم الحذف!',
              text: 'تم مسح جميع الحالات بنجاح.',
              icon: 'success',
              confirmButtonText: 'حسناً'
            });
          }
        });
      }
    });
  }

  statusLabel(s: CaseStatus): string {
    return this.statuses.find(x => x.value === s)?.label ?? s;
  }

  statusClass(s: CaseStatus): string {
    const map: Record<CaseStatus, string> = { Pending: 'warning', UnderInvestigation: 'primary', Approved: 'success', Rejected: 'danger', Closed: '' };
    return `badge badge-${map[s] || 'primary'}`;
  }

  selectedRegion = signal<string | null>(null);
  supportFilter = signal<string>('الكل');
  currentPage = signal<number>(1);
  readonly pageSize = 3;

  availableSupportTypes = computed(() => {
    const region = this.selectedRegion();
    if (!region) return [];
    const group = this.groupedCases().find(g => g.region === region);
    if (!group) return [];
    const types = new Set<string>();
    group.cases.forEach(c => {
      if (c.requiredSupport && c.requiredSupport.trim() !== '') {
        types.add(c.requiredSupport.trim());
      }
    });
    return Array.from(types);
  });

  filteredRegionCases = computed(() => {
    const region = this.selectedRegion();
    if (!region) return [];
    const group = this.groupedCases().find(g => g.region === region);
    if (!group) return [];
    const filter = this.supportFilter();
    if (filter && filter !== 'الكل') {
      return group.cases.filter(c => c.requiredSupport?.trim() === filter);
    }
    return group.cases;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRegionCases().length / this.pageSize)));

  selectedRegionGroup = computed(() => {
    const region = this.selectedRegion();
    if (!region) return null;
    const group = this.groupedCases().find(g => g.region === region);
    if (!group) return null;
    const cases = this.filteredRegionCases();
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return { ...group, cases: cases.slice(start, start + this.pageSize), totalCount: cases.length };
  });

  selectRegion(region: string) {
    this.supportFilter.set('الكل');
    this.currentPage.set(1);
    this.selectedRegion.set(region);
  }

  clearSelection() {
    this.supportFilter.set('الكل');
    this.currentPage.set(1);
    this.selectedRegion.set(null);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  groupedCases = computed(() => {
    const text = this.searchText().trim().toLowerCase();
    const filtered = text 
      ? this.cases().filter(c => 
          c.fullName.toLowerCase().includes(text) || 
          (c.phoneNumber && c.phoneNumber.includes(text)) || 
          (c.nationalId && c.nationalId.includes(text)) || 
          (c.region && c.region.toLowerCase().includes(text))
        )
      : this.cases();

    const groups: { [key: string]: InvestigationCase[] } = {};
    filtered.forEach(c => {
      let region = c.region?.trim();
      if (!region || region === 'غير محدد') {
        region = c.address?.trim() || 'غير محدد';
      }
      if (!groups[region]) groups[region] = [];
      groups[region].push(c);
    });
    return Object.keys(groups).map(key => ({
      region: key,
      cases: groups[key]
    }));
  });
}
