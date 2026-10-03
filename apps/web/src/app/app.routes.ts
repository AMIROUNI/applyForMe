import { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.page').then(m => m.LandingPageComponent),
    title: 'ApplyForME — Your next job, applied for you.'
  },
  ...(isDevMode() ? [{
    path: 'dev/loading',
    loadComponent: () => import('./features/dev-loading/dev-loading.page').then(m => m.DevLoadingPageComponent),
    title: 'Dev Loading Test'
  }] : []),
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