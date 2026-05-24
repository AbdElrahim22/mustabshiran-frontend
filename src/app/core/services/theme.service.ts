import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'mustabshira_theme';
  
  // Use signal for reactive theme state
  currentTheme = signal<Theme>(this.getInitialTheme());

  constructor() {
    // Persist theme changes to localStorage
    effect(() => {
      localStorage.setItem(this.STORAGE_KEY, this.currentTheme());
    });
  }

  toggleTheme() {
    this.currentTheme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  isDark(): boolean {
    return this.currentTheme() === 'dark';
  }

  private getInitialTheme(): Theme {
    const saved = localStorage.getItem(this.STORAGE_KEY) as Theme;
    if (saved) return saved;
    
    // Default to dark as per project's current state
    return 'dark';
  }
}
