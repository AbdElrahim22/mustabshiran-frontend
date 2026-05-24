import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { ToastService } from '../../../core/services/toast.service';
import { ExportService } from '../../../core/services/export.service';

@Component({
  selector: 'app-volunteers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './volunteers.component.html',
  styleUrl: './volunteers.component.scss'
})
export class VolunteersComponent implements OnInit {
  volunteers: any[] = [];
  loading = true;
  showModal = false;
  editingVolunteer: any | null = null;
  submitting = false;

  form = { fullName: '', phoneNumber: '', address: '', study: '' };
  searchText = '';
  private toast = inject(ToastService);
  private api = inject(ApiService);
  private signalR = inject(SignalRService);
  private exportService = inject(ExportService);

  currentPage = 1;
  readonly pageSize = 8;

  get filteredVolunteers() {
    const text = this.searchText.trim().toLowerCase();
    if (!text) return this.volunteers;
    return this.volunteers.filter(v => 
      v.fullName.toLowerCase().includes(text) || 
      (v.phoneNumber && v.phoneNumber.includes(text)) || 
      (v.address && v.address.toLowerCase().includes(text)) ||
      (v.study && v.study.toLowerCase().includes(text))
    );
  }

  get totalPages() { return Math.max(1, Math.ceil(this.filteredVolunteers.length / this.pageSize)); }
  get pagedVolunteers() {
    const p = Math.min(this.currentPage, this.totalPages);
    return this.filteredVolunteers.slice((p - 1) * this.pageSize, p * this.pageSize);
  }
  goToPage(p: number) { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  onSearch() { this.currentPage = 1; }

  exportExcel() { this.exportService.exportToExcel('exportable-table', 'المتطوعين'); }
  exportPdf() { this.exportService.exportToPdf('exportable-table', 'المتطوعين'); }

  constructor() {
    effect(() => {
      const change = this.signalR.lastVolunteerChange();
      if (!change) return;
      if (change.action === 'added') {
        this.volunteers.unshift(change.volunteer);
      } else if (change.action === 'updated') {
        const idx = this.volunteers.findIndex(v => v.id === change.volunteer.id);
        if (idx > -1) this.volunteers[idx] = change.volunteer;
      } else if (change.action === 'deleted') {
        this.volunteers = this.volunteers.filter(v => v.id !== change.volunteerId);
      }
    });
  }

  ngOnInit(): void {
    this.api.getVolunteers().subscribe({ 
      next: (d) => { 
        this.volunteers = d; 
        this.loading = false; 
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openAdd(): void {
    this.editingVolunteer = null;
    this.form = { fullName: '', phoneNumber: '', address: '', study: '' };
    this.showModal = true;
  }

  openEdit(v: any): void {
    this.editingVolunteer = v;
    this.form = { fullName: v.fullName, phoneNumber: v.phoneNumber, address: v.address, study: v.study };
    this.showModal = true;
  }

  submit(): void {
    this.submitting = true;
    const isEdit = !!this.editingVolunteer;
    const obs = this.editingVolunteer
      ? this.api.updateVolunteer(this.editingVolunteer.id, this.form)
      : this.api.addVolunteer(this.form);

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
    this.api.deleteVolunteer(id).subscribe(() => {
      this.toast.success('تم الحذف بنجاح ✅');
    });
  }
}
