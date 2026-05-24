import { Component, OnInit, OnDestroy, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
   <div class="dash-layout" [class.sidebar-open]="isSidebarOpen()">
    <!-- Overlay for mobile -->
    <div class="sidebar-overlay" (click)="toggleSidebar()"></div>

    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span routerLink="/home" style="cursor: pointer;">☪ مستبشرا</span>
        <button class="btn-theme-toggle ms-auto" (click)="theme.toggleTheme()" [title]="theme.isDark() ? 'تبديل للوضع الفاتح' : 'تبديل للوضع الداكن'">
          {{ theme.isDark() ? '☀️' : '🌙' }}
        </button>
        <!-- Close button for mobile -->
        <button class="btn-close-sidebar" (click)="toggleSidebar()">✕</button>
      </div>
      <nav class="sidebar-nav">
        <a routerLink="overview" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
          <span>📊</span> نظرة عامة
        </a>
        @if (!auth.isRestrictedAdmin()) {
          <a routerLink="members" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span>👥</span> الأعضاء
            @if (memberNotif) { <span class="notif-dot"></span> }
          </a>
          <a routerLink="partners" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span>🤝</span> الجمعيات الشريكة
          </a>
          <a routerLink="cases" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span>📋</span> حالات الاستكشاف
            @if (caseNotif) { <span class="notif-dot"></span> }
          </a>
          <a routerLink="volunteers" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span>🙋‍♂️</span> المتطوعين
            @if (volunteerNotif) { <span class="notif-dot"></span> }
          </a>
          <a routerLink="guides" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span>📖</span> الدلائل
          </a>
          <a routerLink="transportations" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span>🛠️</span> تجهيزات
          </a>
        }
        <a routerLink="categories" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
          <span>💰</span> بنود التبرع
        </a>
        <a routerLink="weekly-history" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
          <span>📅</span> سجل العمليات الأسبوعي
        </a>

        @if (auth.isAdmin()) {
          <a routerLink="users" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span>👤</span> المستخدمين
          </a>
        }
      </nav>

      <div class="sidebar-footer">
        <a routerLink="/home" class="nav-item">← الرئيسية</a>
        <button class="btn btn-outline btn-sm" (click)="logout()">خروج</button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="dash-main">
      <header class="dash-header">
        <div class="header-left">
          <button class="btn-sidebar-toggle" (click)="toggleSidebar()">
            <span>☰</span>
          </button>
          <div>
            <h1 class="dash-title">لوحة التحكم</h1>
            <p class="dash-sub">أهلاً، {{ auth.currentUser()?.fullName }}</p>
          </div>
        </div>
        @if (lastDonationMsg) {
          <div class="live-toast">🟢 {{ lastDonationMsg }}</div>
        }
      </header>
      <router-outlet />
    </main>
  </div>
  `,
  styles: [`
    .dash-layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; position: relative; }
    .sidebar { background: var(--bg-card); border-left: 1px solid var(--border); padding: 1.5rem; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; z-index: 100; transition: transform 0.3s ease; }
    .sidebar-logo { font-size: 1.4rem; font-weight: 900; color: var(--accent); margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem; }
    .sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
    .nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 10px; color: var(--text-secondary); transition: var(--transition); cursor: pointer; border: 1px solid transparent; background: none; font-family: inherit; font-size: 0.95rem; text-decoration: none; position: relative; &:hover { background: rgba(46,158,91,0.05); color: var(--text-primary); border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); } &.active { background: rgba(46,158,91,0.15); color: var(--primary-light); font-weight: 600; } }
    .notif-dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; margin-right: auto; animation: pulse 1.5s infinite; }
    .sidebar-footer { border-top: 1px solid var(--border); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .dash-main { padding: 2rem; background: var(--bg-dark); min-width: 0; position: relative; }
    .dash-main::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(46, 158, 91, 0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(240, 165, 0, 0.1) 0%, transparent 50%); pointer-events: none; z-index: 0; }
    .dash-main > * { position: relative; z-index: 1; }
    .dash-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .dash-title { font-size: 1.8rem; font-weight: 900; }
    .dash-sub { color: var(--text-secondary); font-size: 0.9rem; }
    .live-toast { background: rgba(46,158,91,0.15); border: 1px solid rgba(46,158,91,0.3); border-radius: 50px; padding: 0.5rem 1.25rem; font-size: 0.85rem; color: var(--primary-light); animation: slideUp 0.3s ease; }

    /* Sidebar Toggle Buttons */
    .btn-sidebar-toggle, .btn-close-sidebar { display: none; background: var(--bg-card2); border: 1px solid var(--border); color: var(--text-primary); border-radius: 10px; padding: 0.5rem 0.75rem; font-size: 1.25rem; transition: var(--transition); }
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 90; animation: fadeIn 0.3s ease; }

    @media (max-width: 900px) {
      .dash-layout { grid-template-columns: 1fr; }
      .sidebar { position: fixed; right: 0; transform: translateX(100%); width: 280px; box-shadow: -10px 0 30px rgba(0,0,0,0.5); }
      .dash-layout.sidebar-open .sidebar { transform: translateX(0); }
      .dash-layout.sidebar-open .sidebar-overlay { display: block; }
      .btn-sidebar-toggle, .btn-close-sidebar { display: flex; align-items: center; justify-content: center; }
      .dash-main { padding: 1.5rem 1rem; }
      .dash-title { font-size: 1.5rem; }
    }
  `]
})
export class DashboardShellComponent implements OnInit, OnDestroy {
  lastDonationMsg = '';
  memberNotif = false;
  caseNotif = false;
  volunteerNotif = false;
  isSidebarOpen = signal(false);
  private msgTimer: any;

  constructor(public auth: AuthService, public signalR: SignalRService, public theme: ThemeService, private router: Router) {
    effect(() => {
      const d = this.signalR.lastDonation();
      if (d) {
        this.lastDonationMsg = `${d.donorName} تبرع بـ ${d.amount.toLocaleString('ar-EG')} ج.م`;
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => { this.lastDonationMsg = ''; }, 5000);
      }
    });

    effect(() => {
      if (this.signalR.lastMemberChange()) this.memberNotif = true;
    });

    effect(() => {
      if (this.signalR.lastCaseChange()) this.caseNotif = true;
    });

    effect(() => {
      if (this.signalR.lastVolunteerChange()) this.volunteerNotif = true;
    });
  }

  ngOnInit(): void { 
    // Security: Only admins can access dashboard
    if (!this.auth.isAnyAdmin()) {
      this.router.navigate(['/home']);
      return;
    }
    this.signalR.startConnection(); 
  }

  toggleSidebar(): void {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }

  ngOnDestroy(): void { this.signalR.stopConnection(); clearTimeout(this.msgTimer); }
}
