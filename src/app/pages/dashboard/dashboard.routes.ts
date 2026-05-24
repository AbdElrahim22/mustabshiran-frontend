import { Routes } from '@angular/router';

export const dashboardRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard-shell/dashboard-shell.component').then(m => m.DashboardShellComponent),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', loadComponent: () => import('./overview/overview.component').then(m => m.OverviewComponent) },
      { path: 'members', loadComponent: () => import('./members/members.component').then(m => m.MembersComponent) },
      { path: 'partners', loadComponent: () => import('./partners/partners.component').then(m => m.PartnersComponent) },
      { path: 'cases', loadComponent: () => import('./cases/cases.component').then(m => m.CasesComponent) },
      { path: 'categories', loadComponent: () => import('./categories/categories.component').then(m => m.CategoriesComponent) },
      { path: 'users', loadComponent: () => import('./users/users-management.component').then(m => m.UsersManagementComponent) },
      { path: 'weekly-history', loadComponent: () => import('./weekly-history/weekly-history.component').then(m => m.WeeklyHistoryComponent) },
      { path: 'global-liquidity', loadComponent: () => import('./global-liquidity/global-liquidity.component').then(m => m.GlobalLiquidityComponent) },
      { path: 'volunteers', loadComponent: () => import('./volunteers/volunteers.component').then(m => m.VolunteersComponent) },
      { path: 'guides', loadComponent: () => import('./guides/guides.component').then(m => m.GuidesComponent) },
      { path: 'transportations', loadComponent: () => import('./transportations/transportations.component').then(m => m.TransportationsComponent) }

    ]
  }
];
