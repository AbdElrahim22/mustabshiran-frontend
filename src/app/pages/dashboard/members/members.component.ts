import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { AssociationMember, MemberDto } from '../../../core/models/models';
import { ToastService } from '../../../core/services/toast.service';
import { ExportService } from '../../../core/services/export.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members.component.html',
  styleUrl: './members.component.scss'
})
export class MembersComponent implements OnInit {
  members: AssociationMember[] = [];
  loading = true;
  showModal = false;
  editingMember: AssociationMember | null = null;
  submitting = false;

  form: MemberDto = { fullName: '', phoneNumber: '', role: '', address: '' };
  searchText: string = '';
  private toast = inject(ToastService);
  private exportService = inject(ExportService);

  currentPage = 1;
  readonly pageSize = 8;

  get filteredMembers() {
    const text = this.searchText.trim().toLowerCase();
    if (!text) return this.members;
    return this.members.filter(m => 
      m.fullName.toLowerCase().includes(text) || 
      m.phoneNumber.includes(text) || 
      (m.role && m.role.toLowerCase().includes(text)) || 
      (m.address && m.address.toLowerCase().includes(text))
    );
  }

  get totalPages() { return Math.max(1, Math.ceil(this.filteredMembers.length / this.pageSize)); }
  get pagedMembers() {
    const p = Math.min(this.currentPage, this.totalPages);
    return this.filteredMembers.slice((p - 1) * this.pageSize, p * this.pageSize);
  }
  goToPage(p: number) { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  onSearch() { this.currentPage = 1; }

  exportExcel() { this.exportService.exportToExcel('exportable-table', 'الأعضاء'); }
  exportPdf() { this.exportService.exportToPdf('exportable-table', 'الأعضاء'); }

  constructor(private api: ApiService, private signalR: SignalRService) {
    effect(() => {
      const change = this.signalR.lastMemberChange();
      if (!change) return;
      if (change.action === 'added') {
        this.members.unshift(change.member);
      } else if (change.action === 'updated') {
        const idx = this.members.findIndex(m => m.id === change.member.id);
        if (idx > -1) this.members[idx] = change.member;
      } else if (change.action === 'deleted') {
        this.members = this.members.filter(m => m.id !== change.memberId);
      }
    });
  }

  ngOnInit(): void {
    this.api.getMembers().subscribe({ next: (d) => { this.members = d; this.loading = false; } });
  }

  openAdd(): void {
    this.editingMember = null;
    this.form = { fullName: '', phoneNumber: '', role: '', address: '' };
    this.showModal = true;
  }

  openEdit(m: AssociationMember): void {
    this.editingMember = m;
    this.form = { fullName: m.fullName, phoneNumber: m.phoneNumber, role: m.role, address: m.address };
    this.showModal = true;
  }

  submit(): void {
    this.submitting = true;
    const isEdit = !!this.editingMember;
    const obs = this.editingMember
      ? this.api.updateMember(this.editingMember.id, this.form)
      : this.api.addMember(this.form);

    obs.subscribe({
      next: () => { 
        this.showModal = false; 
        this.submitting = false; 
        this.toast.success(isEdit ? 'تم التعديل بنجاح ✅' : 'تمت الإضافة بنجاح ✅');
      },
      error: () => { this.submitting = false; }
    });
  }

  delete(id: string): void {
    if (!confirm('هل أنت متأكد من الحذف نهائياً؟')) return;
    this.api.deleteMember(id).subscribe(() => {
      this.toast.success('تم الحذف بنجاح ✅');
    });
  }
}
