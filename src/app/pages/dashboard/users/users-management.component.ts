import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <div>
          <h2 class="section-title">👤 إدارة المستخدمين</h2>
          <p class="section-desc">عرض جميع الحسابات المسجلة وتغيير صلاحياتهم</p>
        </div>
        <div class="actions-group">
          <input type="text" [(ngModel)]="searchText" placeholder="🔍 بحث عن مستخدم..." class="search-input">
          <button class="btn btn-outline" (click)="loadUsers()">🔄 تحديث</button>
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">⏳ جاري التحميل...</div>
      } @else {
        <div class="users-table-wrapper">
          <table class="data-table users-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الدور الحالي</th>
                <th>تغيير الدور</th>
                <th>كلمة المرور</th>
                <th>حذف</th>
              </tr>
            </thead>
            <tbody>
              @for (user of filteredUsers; track user.id; let i = $index) {
                <tr [class.self-row]="user.id === currentUserId">
                  <td class="row-num" data-label="#">{{ i + 1 }}</td>
                  <td data-label="الاسم">
                    <div class="user-name">{{ user.fullName }}</div>
                    @if (user.id === currentUserId) {
                      <span class="you-badge">أنت</span>
                    }
                  </td>
                  <td class="email-cell" data-label="البريد الإلكتروني">{{ user.email }}</td>
                  <td data-label="الدور الحالي">
                    <span class="role-badge" [class]="'role-' + getRoleClass(user.role)">
                      {{ getRoleLabel(user.role) }}
                    </span>
                  </td>
                  <td data-label="تغيير الدور">
                    <select [(ngModel)]="user.selectedRole" class="role-select"
                            (change)="changeRole(user)">
                      <option value="User">مستخدم</option>
                      <option value="RestrictedAdmin">مسؤول مالية</option>
                      <option value="Admin">مسؤول النظام</option>
                    </select>
                  </td>
                  <td data-label="كلمة المرور">
                    <button class="btn-reset" (click)="resetPassword(user)"
                            title="إعادة تعيين كلمة المرور">🔑</button>
                  </td>
                  <td data-label="حذف">
                    @if (user.id !== currentUserId) {
                      <button class="btn-delete" (click)="deleteUser(user)"
                              title="حذف الحساب">🗑️</button>
                    } @else {
                      <span class="text-muted">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { animation: fadeIn 0.4s ease-out; }
    .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
    .actions-group { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .search-input {
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-dark);
      color: var(--text-primary);
      outline: none;
      font-size: 0.9rem;
      transition: border-color 0.2s;
      width: 240px;
      &:focus { border-color: var(--primary-light); }
    }
    @media (max-width: 768px) {
      .header-actions { flex-direction: column; align-items: stretch; text-align: center; }
      .actions-group { flex-direction: column; align-items: stretch; width: 100%; }
      .search-input { width: 100%; text-align: center; }
      .btn { width: 100%; justify-content: center; }
    }
    .section-title { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.25rem; }
    .section-desc { color: var(--text-secondary); font-size: 0.9rem; }
    .loading-state { text-align: center; padding: 3rem; color: var(--text-secondary); font-size: 1.1rem; }

    .users-table-wrapper {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      overflow-x: auto;
    }

    .users-table {
      width: 100%;
      border-collapse: collapse;
      direction: rtl;

      thead tr {
        background: rgba(46,158,91,0.08);
        border-bottom: 1px solid var(--border);
      }

      th {
        padding: 1rem 1.25rem;
        text-align: right;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-secondary);
        letter-spacing: 0.03em;
      }

      tbody tr {
        border-bottom: 1px solid rgba(255,255,255,0.04);
        transition: background 0.2s;

        &:hover { background: rgba(255,255,255,0.03); }
        &:last-child { border-bottom: none; }
        &.self-row { background: rgba(46,158,91,0.05); }
      }

      td {
        padding: 1rem 1.25rem;
        vertical-align: middle;
        font-size: 0.95rem;
      }
    }

    .row-num { color: var(--text-muted); font-size: 0.85rem; width: 40px; }
    .email-cell { color: var(--text-secondary); font-size: 0.9rem; direction: ltr; text-align: left; }
    .text-muted { color: var(--text-muted); }

    .user-name { font-weight: 600; color: var(--text-primary); }
    .you-badge {
      display: inline-block;
      font-size: 0.7rem;
      background: rgba(46,158,91,0.2);
      color: var(--primary-light);
      border: 1px solid var(--primary-light);
      padding: 2px 8px;
      border-radius: 50px;
      margin-top: 3px;
    }

    .role-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 50px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .role-admin { background: rgba(250,204,21,0.15); color: #facc15; border: 1px solid rgba(250,204,21,0.3); }
    .role-restricted { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }
    .role-user { background: rgba(156,163,175,0.1); color: #9ca3af; border: 1px solid rgba(156,163,175,0.2); }

    .role-select {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      color: var(--text-primary);
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.2s;
      &:focus { outline: none; border-color: var(--accent); }
    }

    .btn-reset {
      background: rgba(59,130,246,0.1);
      border: 1px solid rgba(59,130,246,0.3);
      color: #60a5fa;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: 0.2s;
      margin-left: 5px;
      &:hover { background: rgba(59,130,246,0.25); transform: scale(1.1); }
    }

    .btn-delete {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.3);
      color: #ef4444;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: 0.2s;
      &:hover { background: rgba(239,68,68,0.25); transform: scale(1.1); }
    }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class UsersManagementComponent implements OnInit {
  users: any[] = [];
  loading = true;
  currentUserId = '';
  searchText = '';

  get filteredUsers(): any[] {
    if (!this.searchText || this.searchText.trim() === '') {
      return this.users;
    }
    const query = this.searchText.toLowerCase().trim();
    return this.users.filter(u =>
      (u.fullName && u.fullName.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query))
    );
  }

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  ngOnInit(): void {
    this.currentUserId = this.auth.currentUser()?.userId || '';
    this.loadUsers();
  }

  private sortUsers(): void {
    const priority: any = { 'Admin': 1, 'RestrictedAdmin': 2, 'User': 3 };
    this.users.sort((a, b) => {
      const pA = priority[a.role] || 99;
      const pB = priority[b.role] || 99;
      if (pA !== pB) return pA - pB;
      return a.fullName.localeCompare(b.fullName, 'ar');
    });
  }

  loadUsers(): void {
    this.loading = true;
    this.api.getUsers().subscribe({
      next: (data) => {
        this.users = data.map(u => ({ ...u, selectedRole: u.role }));
        this.sortUsers();
        this.loading = false;
      },
      error: () => {
        this.toast.error('حدث خطأ في تحميل المستخدمين');
        this.loading = false;
      }
    });
  }

  changeRole(user: any): void {
    if (user.selectedRole === user.role) return;

    // Warning if changing own role from Admin
    if (user.id === this.currentUserId && user.role === 'Admin' && user.selectedRole !== 'Admin') {
      if (!confirm('تنبيه: أنت تقوم بتغيير دورك من مسؤول نظام. قد تفقد صلاحية الوصول لهذه الصفحة فور التغيير. هل تريد الاستمرار؟')) {
        user.selectedRole = user.role;
        return;
      }
    }

    this.api.changeUserRole(user.id, user.selectedRole).subscribe({
      next: () => {
        this.toast.success(`تم تغيير دور ${user.fullName} إلى ${this.getRoleLabel(user.selectedRole)} ✅`);
        user.role = user.selectedRole;
        this.sortUsers();

        // If updated self, user might need to relogin to update token permissions
        if (user.id === this.currentUserId) {
          this.toast.info('يرجى إعادة تسجيل الدخول لتحديث الصلاحيات الجديدة.');
        }
      },
      error: (err) => {
        this.toast.error('حدث خطأ: ' + (err.error?.message || err.message));
        user.selectedRole = user.role; // revert
      }
    });
  }

  resetPassword(user: any): void {
    const newPass = prompt(`أدخل كلمة المرور الجديدة للمستخدم "${user.fullName}":`);
    if (!newPass || newPass.trim().length < 6) {
      if (newPass) this.toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    this.api.resetUserPassword(user.id, newPass).subscribe({
      next: () => this.toast.success(`تم تغيير كلمة المرور لـ ${user.fullName} بنجاح ✅`),
      error: (err) => this.toast.error('حدث خطأ: ' + (err.error?.message || err.message))
    });
  }

  deleteUser(user: any): void {
    if (!confirm(`هل أنت متأكد من الحذف نهائياً لحساب "${user.fullName}"؟`)) return;
    this.api.deleteUser(user.id).subscribe({
      next: () => {
        this.toast.success(`تم حذف حساب ${user.fullName} بنجاح ✅`);
        this.users = this.users.filter(u => u.id !== user.id);
      },
      error: (err) => {
        this.toast.error('حدث خطأ أثناء الحذف: ' + (err.error?.message || err.message));
      }
    });
  }

  getRoleLabel(role: string): string {
    const map: any = {
      'Admin': 'مسؤول النظام',
      'RestrictedAdmin': 'مسؤول مالية',
      'User': 'مستخدم'
    };
    return map[role] || role;
  }

  getRoleClass(role: string): string {
    const map: any = { 'Admin': 'admin', 'RestrictedAdmin': 'restricted', 'User': 'user' };
    return map[role] || 'user';
  }
}
