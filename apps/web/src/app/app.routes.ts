import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.page').then(m => m.LandingPageComponent),
    title: 'ApplyForME — Your next job, applied for you.'
  }
  // Future routes (to be implemented in later steps):
  // {
  //   path: 'login',
  //   loadComponent: () => import('./features/login/login.page').then(m => m.LoginPageComponent)
  // },
  // {
  //   path: 'register',
  //   loadComponent: () => import('./features/register/register.page').then(m => m.RegisterPageComponent)
  // },
  // {
  //   path: 'dashboard',
  //   loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPageComponent)
  // }
];