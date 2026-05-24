import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { ToastService } from '../../../core/services/toast.service';
import { ExportService } from '../../../core/services/export.service';

@Component({
  selector: 'app-guides',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guides.component.html',
  styleUrls: ['../volunteers/volunteers.component.scss']
})
export class GuidesComponent implements OnInit {
  guides: any[] = [];
  loading = true;
  showModal = false;
  editingGuide: any | null = null;
  submitting = false;

  form = { name: '', phoneNumber: '', location: '' };
  searchText = '';
  private toast = inject(ToastService);
  private api = inject(ApiService);
  private signalR = inject(SignalRService);
  private exportService = inject(ExportService);

  currentPage = 1;
  readonly pageSize = 8;

  get filteredGuides() {
    const text = this.searchText.trim().toLowerCase();
    if (!text) return this.guides;
    return this.guides.filter(g => 
      g.name.toLowerCase().includes(text) || 
      (g.phoneNumber && g.phoneNumber.includes(text)) || 
      (g.location && g.location.toLowerCase().includes(text))
    );
  }

  get totalPages() { return Math.max(1, Math.ceil(this.filteredGuides.length / this.pageSize)); }
  get pagedGuides() {
    const p = Math.min(this.currentPage, this.totalPages);
    return this.filteredGuides.slice((p - 1) * this.pageSize, p * this.pageSize);
  }
  goToPage(p: number) { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  onSearch() { this.currentPage = 1; }

  exportExcel() { this.exportService.exportToExcel('exportable-table', 'الدلائل'); }
  exportPdf() { this.exportService.exportToPdf('exportable-table', 'الدلائل'); }

  constructor() {
    effect(() => {
      const change = this.signalR.lastGuideChange();
      if (!change) return;
      if (change.action === 'added') {
        this.guides.unshift(change.guide);
      } else if (change.action === 'updated') {
        const idx = this.guides.findIndex(g => g.id === change.guide.id);
        if (idx > -1) this.guides[idx] = change.guide;
      } else if (change.action === 'deleted') {
        this.guides = this.guides.filter(g => g.id !== change.guideId);
      }
    });
  }

  ngOnInit(): void {
    this.api.getGuides().subscribe({ 
      next: (d) => { this.guides = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openAdd(): void {
    this.editingGuide = null;
    this.form = { name: '', phoneNumber: '', location: '' };
    this.showModal = true;
  }

  openEdit(g: any): void {
    this.editingGuide = g;
    this.form = { name: g.name, phoneNumber: g.phoneNumber, location: g.location };
    this.showModal = true;
  }

  submit(): void {
    this.submitting = true;
    const isEdit = !!this.editingGuide;
    const obs = this.editingGuide
      ? this.api.updateGuide(this.editingGuide.id, this.form)
      : this.api.addGuide(this.form);

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
    this.api.deleteGuide(id).subscribe(() => {
      this.toast.success('تم الحذف بنجاح ✅');
    });
  }
}
