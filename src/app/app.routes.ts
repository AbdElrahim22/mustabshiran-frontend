import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Default: Redirect to dashboard (authGuard will handle unauthenticated users)
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  // Home page (now accessible at /home or similar if needed, or just remove if only login needed)
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  // Donation page for a specific category (requires login)
  {
    path: 'donate/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/donate/donate.component').then(m => m.DonateComponent)
  },
  // Auth pages
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then(m => m.authRoutes)
  },
  // Dashboard (requires login)
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./pages/dashboard/dashboard.routes').then(m => m.dashboardRoutes)
  },
  { path: '**', redirectTo: 'auth/login' }
];
