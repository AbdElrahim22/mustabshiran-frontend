import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SignalRService } from '../../core/services/signalr.service';
import { DonationCategory, MyDonation } from '../../core/models/models';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-donate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './donate.component.html',
  styleUrl: './donate.component.scss'
})
export class DonateComponent implements OnInit {
  category: DonationCategory | null = null;
  myDonations: MyDonation[] = [];
  amount: number | null = null;
  loading = true;
  submitting = false;
  successMsg = '';
  errorMsg = '';
  private toast = inject(ToastService);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public signalR: SignalRService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.signalR.startConnection();

    // Load category info
    this.api.getCategory(id).subscribe({
      next: (cat) => { this.category = cat; this.loading = false; },
      error: () => { this.loading = false; this.errorMsg = 'حدث خطأ في تحميل البيانات'; }
    });

    // Load user's previous donations for this category
    this.api.getMyDonations().subscribe({
      next: (list) => {
        this.myDonations = list.filter(d => d.category.id === id);
      }
    });
  }

  get myTotal(): number {
    return this.myDonations.reduce((s, d) => s + d.amount, 0);
  }

  submit(): void {
    if (!this.amount || this.amount <= 0 || !this.category) return;

    this.submitting = true;
    this.successMsg = '';
    this.errorMsg = '';

    this.api.addDonation({ categoryId: this.category.id, amount: this.amount }).subscribe({
      next: (res) => {
        // Add new donation to local history and update total
        this.myDonations.unshift({
          id: crypto.randomUUID(),
          amount: this.amount!,
          createdAt: new Date().toISOString(),
          category: { id: this.category!.id, name: this.category!.name }
        });
        this.category!.totalAmount = res.newTotal;
        this.successMsg = res.message;
        this.amount = null;
        this.submitting = false;
        this.toast.success('تمت الإضافة بنجاح ✅');
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'حدث خطأ، حاول مرة أخرى';
        this.submitting = false;
      }
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(amount);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
