import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { ToastService } from '../../../core/services/toast.service';
import { ExportService } from '../../../core/services/export.service';

@Component({
  selector: 'app-transportations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transportations.component.html',
  styleUrls: ['../volunteers/volunteers.component.scss']
})
export class TransportationsComponent implements OnInit {
  transportations: any[] = [];
  loading = true;
  showModal = false;
  editingItem: any | null = null;
  submitting = false;

  form = { name: '', phoneNumber: '' };
  searchText = '';
  private toast = inject(ToastService);
  private api = inject(ApiService);
  private signalR = inject(SignalRService);
  private exportService = inject(ExportService);

  currentPage = 1;
  readonly pageSize = 8;

  get filteredTransportations() {
    const text = this.searchText.trim().toLowerCase();
    if (!text) return this.transportations;
    return this.transportations.filter(t => 
      t.name.toLowerCase().includes(text) || 
      (t.phoneNumber && t.phoneNumber.includes(text))
    );
  }

  get totalPages() { return Math.max(1, Math.ceil(this.filteredTransportations.length / this.pageSize)); }
  get pagedTransportations() {
    const p = Math.min(this.currentPage, this.totalPages);
    return this.filteredTransportations.slice((p - 1) * this.pageSize, p * this.pageSize);
  }
  goToPage(p: number) { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  onSearch() { this.currentPage = 1; }

  exportExcel() { this.exportService.exportToExcel('exportable-table', 'تجهيزات'); }
  exportPdf() { this.exportService.exportToPdf('exportable-table', 'تجهيزات'); }

  constructor() {
    effect(() => {
      const change = this.signalR.lastTransportationChange();
      if (!change) return;
      if (change.action === 'added') {
        this.transportations.unshift(change.transportation);
      } else if (change.action === 'updated') {
        const idx = this.transportations.findIndex(t => t.id === change.transportation.id);
        if (idx > -1) this.transportations[idx] = change.transportation;
      } else if (change.action === 'deleted') {
        this.transportations = this.transportations.filter(t => t.id !== change.transportationId);
      }
    });
  }

  ngOnInit(): void {
    this.api.getTransportations().subscribe({ 
      next: (d) => { this.transportations = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openAdd(): void {
    this.editingItem = null;
    this.form = { name: '', phoneNumber: '' };
    this.showModal = true;
  }

  openEdit(t: any): void {
    this.editingItem = t;
    this.form = { name: t.name, phoneNumber: t.phoneNumber };
    this.showModal = true;
  }

  submit(): void {
    this.submitting = true;
    const isEdit = !!this.editingItem;
    const obs = this.editingItem
      ? this.api.updateTransportation(this.editingItem.id, this.form)
      : this.api.addTransportation(this.form);

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
    this.api.deleteTransportation(id).subscribe(() => {
      this.toast.success('تم الحذف بنجاح ✅');
    });
  }
}
