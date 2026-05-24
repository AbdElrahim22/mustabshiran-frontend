import { Injectable, signal } from '@angular/core';
import { AuthResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'mustabshira_token';
  private readonly USER_KEY = 'mustabshira_user';

  currentUser = signal<AuthResponse | null>(this.loadUser());
  isAdmin = () => this.currentUser()?.role === 'Admin';
  isRestrictedAdmin = () => this.currentUser()?.role === 'RestrictedAdmin';
  isUser = () => this.currentUser()?.role === 'User';
  isAnyAdmin = () => this.isAdmin() || this.isRestrictedAdmin();

  private loadUser(): AuthResponse | null {
    const raw = sessionStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  setAuth(response: AuthResponse): void {
    sessionStorage.setItem(this.TOKEN_KEY, response.token);
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(response));
    this.currentUser.set(response);
  }

  logout(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
