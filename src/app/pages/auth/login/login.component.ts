import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="auth-page">
    <div class="auth-box">
      <div class="auth-logo">☪ مستبشرا</div>
      <h2>تسجيل الدخول</h2>
      <p class="auth-sub">أهلاً بك، تبرعاتك تصنع الفارق</p>

      @if (errorMsg) { <div class="alert alert-danger">❌ {{ errorMsg }}</div> }

      <form (ngSubmit)="loginForm.form.valid && login()" #loginForm="ngForm" autocomplete="off">
        <div class="form-group">
          <label>البريد الإلكتروني</label>
          <input type="email" [(ngModel)]="email" name="u_acc" #emailInput="ngModel" placeholder="email@example.com" required autocomplete="off" />
          @if (loginForm.submitted && emailInput.invalid) {
            <div class="error-msg" style="color: #ef4444; font-size: 0.85rem; margin-top: 5px;">⚠️ يرجى إدخال البريد الإلكتروني</div>
          }
        </div>
        <div class="form-group">
          <label>كلمة المرور</label>
          <div class="password-wrapper">
            <input [type]="showPassword ? 'text' : 'password'" [(ngModel)]="password" name="p_sec" #passInput="ngModel" placeholder="••••••••" required 
                   autocomplete="new-password" spellcheck="false" />
            <button type="button" class="btn-toggle" (click)="showPassword = !showPassword" [title]="showPassword ? 'إخفاء' : 'إظهار'">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          @if (loginForm.submitted && passInput.invalid) {
            <div class="error-msg" style="color: #ef4444; font-size: 0.85rem; margin-top: 5px;">⚠️ يرجى إدخال كلمة المرور</div>
          }
        </div>
        <button type="submit" class="btn btn-primary btn-block" [disabled]="loading">
          {{ loading ? 'جاري الدخول...' : 'دخول ←' }}
        </button>
      </form>

      <p class="auth-footer">
        ليس لديك حساب؟ <a routerLink="/auth/register">أنشئ حساباً</a>
      </p>
    </div>
  </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; background: radial-gradient(ellipse at top, rgba(46,158,91,0.15), transparent 60%); }
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
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  errorMsg = '';
  showPassword = false;

  constructor(private api: ApiService, private authService: AuthService, private router: Router) {}

  login(): void {
    this.loading = true;
    this.errorMsg = '';
    this.api.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.authService.setAuth(res);
        
        // Role-based redirection
        const user = this.authService.currentUser();
        if (user?.role === 'Admin' || user?.role === 'RestrictedAdmin') {
          this.router.navigate(['/dashboard']);
        } else {
          this.router.navigate(['/home']);
        }
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'بيانات الدخول غير صحيحة';
        this.loading = false;
      }
    });
  }
}
