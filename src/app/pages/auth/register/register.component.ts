import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="auth-page">
    <div class="auth-box">
      <div class="auth-logo">☪ مستبشرا</div>
      <h2>إنشاء حساب جديد</h2>
      <p class="auth-sub">انضم إلينا وكن من المتبرعين</p>

      @if (successMsg) { <div class="alert alert-success">✅ {{ successMsg }}</div> }
      @if (errorMsg) { <div class="alert alert-danger">❌ {{ errorMsg }}</div> }

      <form (ngSubmit)="registerForm.form.valid && register()" #registerForm="ngForm">
        <div class="form-group">
          <label>الاسم الكامل</label>
          <input type="text" [(ngModel)]="fullName" name="fullName" #fnameInput="ngModel" placeholder="محمد أحمد" required />
          @if (registerForm.submitted && fnameInput.invalid) {
            <div class="error-msg" style="color: #ef4444; font-size: 0.85rem; margin-top: 5px;">⚠️ يرجى إدخال الاسم الكامل</div>
          }
        </div>
        <div class="form-group">
          <label>البريد الإلكتروني</label>
          <input type="email" [(ngModel)]="email" name="email" #emailInput="ngModel" placeholder="email@example.com" required />
          @if (registerForm.submitted && emailInput.invalid) {
            <div class="error-msg" style="color: #ef4444; font-size: 0.85rem; margin-top: 5px;">⚠️ يرجى إدخال بريد إلكتروني صحيح</div>
          }
        </div>
        <div class="form-group">
          <label>كلمة المرور</label>
          <div class="password-wrapper">
            <input [type]="showPassword ? 'text' : 'password'" [(ngModel)]="password" name="password" #passInput="ngModel" placeholder="٦ أحرف على الأقل" required minlength="6" />
            <button type="button" class="btn-toggle" (click)="showPassword = !showPassword" [title]="showPassword ? 'إخفاء' : 'إظهار'">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          @if (registerForm.submitted && passInput.invalid) {
            <div class="error-msg" style="color: #ef4444; font-size: 0.85rem; margin-top: 5px;">⚠️ كلمة المرور مطلوبة (٦ أحرف على الأقل)</div>
          }
        </div>
        <button type="submit" class="btn btn-accent btn-block" [disabled]="loading">
          {{ loading ? 'جاري الإنشاء...' : 'إنشاء الحساب ←' }}
        </button>
      </form>

      <p class="auth-footer">
        لديك حساب؟ <a routerLink="/auth/login">سجل دخولك</a>
      </p>
    </div>
  </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; background: radial-gradient(ellipse at top, rgba(240,165,0,0.1), transparent 60%); }
    .auth-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2.5rem; width: 100%; max-width: 420px; }
    .auth-logo { font-size: 1.5rem; font-weight: 900; color: var(--accent); text-align: center; margin-bottom: 1.5rem; }
    h2 { text-align: center; margin-bottom: 0.5rem; }
    .auth-sub { text-align: center; color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.9rem; }
    .btn-block { width: 100%; justify-content: center; margin-top: 0.5rem; }
    .auth-footer { text-align: center; margin-top: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; a { color: var(--primary-light); } }
    
    .password-wrapper { position: relative; display: flex; align-items: center; }
    .password-wrapper input { padding-left: 2.5rem !important; direction: ltr !important; text-align: right; }
    .btn-toggle { position: absolute; left: 0.75rem; background: none; border: none; font-size: 1.1rem; cursor: pointer; opacity: 0.6; transition: 0.2s; &:hover { opacity: 1; } }
  `]
})
export class RegisterComponent {
  fullName = '';
  email = '';
  password = '';
  loading = false;
  successMsg = '';
  errorMsg = '';
  showPassword = false;

  constructor(private api: ApiService, private router: Router) {}

  register(): void {
    this.loading = true;
    this.errorMsg = '';
    this.api.register({ fullName: this.fullName, email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.successMsg = res.message + ' — يمكنك تسجيل الدخول الآن';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err) => {
        this.errorMsg = err?.error?.[0]?.description || 'حدث خطأ، حاول مرة أخرى';
        this.loading = false;
      }
    });
  }
}
