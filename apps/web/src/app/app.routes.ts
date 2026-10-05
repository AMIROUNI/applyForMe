import { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.page').then(m => m.LandingPageComponent),
    title: 'ApplyForME — Your next job, applied for you.'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPageComponent),
    title: 'Log in — ApplyForME'
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.page').then(m => m.RegisterPageComponent),
    title: 'Create account — ApplyForME'
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/auth-callback.page').then(m => m.AuthCallbackPageComponent),
    title: 'Signing in — ApplyForME'
  },
  ...(isDevMode() ? [{
    path: 'dev/loading',
    loadComponent: () => import('./features/dev-loading/dev-loading.page').then(m => m.DevLoadingPageComponent),
    title: 'Dev Loading Test'
  }] : []),
  { path: '**', redirectTo: '' }
];
