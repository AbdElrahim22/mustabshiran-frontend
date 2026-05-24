import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './core/services/theme.service';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <router-outlet />

    @if (toast.toast()) {
      <div class="global-toast" [class]="'toast-' + toast.toast()!.type">
        <span class="toast-icon">{{ toast.toast()!.type === 'success' ? '✅' : toast.toast()!.type === 'error' ? '❌' : 'ℹ️' }}</span>
        <span class="toast-text">{{ toast.toast()!.message }}</span>
      </div>
    }
  `,
  styles: [`
    .global-toast {
      position: fixed;
      top: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.85rem 1.75rem;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
      z-index: 99999;
      white-space: nowrap;
      animation: toastSlideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      direction: rtl;
    }
    .toast-success { background: #1a2e1a; color: #4ade80; border: 1px solid #22c55e; }
    .toast-error   { background: #2e1a1a; color: #f87171; border: 1px solid #ef4444; }
    .toast-info    { background: #1a1f2e; color: #60a5fa; border: 1px solid #3b82f6; }
    .toast-icon    { font-size: 1.1rem; }

    @keyframes toastSlideDown {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `]
})
export class AppComponent {
  private themeService = inject(ThemeService);
  toast = inject(ToastService);

  constructor() {
    effect(() => {
      const isDark = this.themeService.isDark();
      if (!isDark) {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    });
  }
}
