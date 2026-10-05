export const AUTH_PAGE_STYLES = `
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-6) var(--spacing-4);
    background: var(--color-bg);
  }

  .auth-card {
    width: 100%;
    max-width: 420px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    padding: var(--spacing-6) var(--spacing-5);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
  }

  .auth-card__logo {
    display: inline-block;
    margin-bottom: var(--spacing-5);
  }

  .auth-card__logo-img {
    height: 32px;
    width: auto;
  }

  .auth-card__title {
    font-size: var(--text-2xl);
    margin: 0 0 var(--spacing-2);
  }

  .auth-card__subtitle {
    margin: 0 0 var(--spacing-5);
    color: var(--color-text-muted);
    font-size: var(--text-base);
  }

  .auth-alert {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-input);
    background: var(--color-danger-soft);
    color: var(--color-danger);
    font-size: var(--text-sm);
    margin-bottom: var(--spacing-4);
    border: 1px solid var(--color-danger);
  }

  .auth-field {
    margin-bottom: var(--spacing-4);
  }

  .auth-field__label {
    display: block;
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--spacing-2);
  }

  .auth-field__input {
    width: 100%;
    height: 44px;
    padding: 0 var(--spacing-4);
    font-size: var(--text-base);
    font-family: var(--font-body);
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-input);
    transition: border-color var(--transition-duration) var(--transition-ease),
      box-shadow var(--transition-duration) var(--transition-ease);
  }

  .auth-field__input::placeholder {
    color: var(--color-text-muted);
  }

  .auth-field__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-focus-ring);
  }

  .auth-field__input[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  .auth-field__error {
    display: block;
    margin-top: var(--spacing-2);
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  .auth-submit {
    width: 100%;
    margin-top: var(--spacing-2);
  }

  .auth-divider {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    margin: var(--spacing-5) 0 var(--spacing-4);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .auth-divider::before,
  .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  .auth-google {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-3);
    width: 100%;
    height: 44px;
    padding: 0 var(--spacing-4);
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-input);
    cursor: pointer;
    transition: background var(--transition-duration) var(--transition-ease),
      border-color var(--transition-duration) var(--transition-ease);
  }

  .auth-google:hover:not(:disabled) {
    background: var(--color-surface-alt);
    border-color: var(--color-text-muted, var(--color-border));
  }

  .auth-google:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-google:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-focus-ring);
  }

  .auth-google__icon {
    width: 18px;
    height: 18px;
  }

  .auth-switch {
    margin: var(--spacing-5) 0 0;
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .auth-switch a {
    color: var(--color-primary);
    font-weight: var(--font-weight-medium);
    text-decoration: none;
  }

  .auth-switch a:hover {
    text-decoration: underline;
  }

  .auth-footer-link {
    display: block;
    margin-top: var(--spacing-4);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
  }

  .auth-footer-link:hover {
    color: var(--color-primary);
  }

  .auth-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-4);
    text-align: center;
    padding: var(--spacing-6) 0;
  }

  .auth-status__spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: auth-spin 0.8s linear infinite;
  }

  @keyframes auth-spin {
    to { transform: rotate(360deg); }
  }
`;

