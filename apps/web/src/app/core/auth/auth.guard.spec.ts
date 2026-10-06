import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

type GuardResult = boolean | UrlTree | Promise<boolean | UrlTree> | Observable<boolean | UrlTree>;

describe('authGuard', () => {
  const runGuard = (url = '/dashboard'): GuardResult =>
    TestBed.runInInjectionContext(() => authGuard({} as never, { url } as never) as GuardResult);

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows navigation when the user is logged in', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            checkSession: jasmine.createSpy('checkSession'),
            loggedIn: () => true,
            initialized: () => true,
          },
        },
      ],
    });

    expect(runGuard()).toBeTrue();
  });

  it('redirects to login with returnUrl when initialized and anonymous', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            checkSession: jasmine.createSpy('checkSession'),
            loggedIn: () => false,
            initialized: () => true,
          },
        },
      ],
    });

    const result = runGuard('/dashboard?tab=1');
    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    expect(tree.root.children['primary'].segments[0].path).toBe('login');
    expect(tree.queryParams['returnUrl']).toBe('/dashboard?tab=1');
  });

  it('waits for the session check to resolve before redirecting', (done) => {
    const initialized = signal(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            checkSession: jasmine.createSpy('checkSession'),
            loggedIn: () => false,
            initialized,
          },
        },
      ],
    });

    const result = runGuard('/dashboard') as Observable<boolean | UrlTree>;
    expect(result instanceof Observable).toBeTrue();

    result.subscribe((value) => {
      expect(value).toBeInstanceOf(UrlTree);
      done();
    });

    initialized.set(true);
  });
});
