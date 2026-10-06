import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MultiSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="multi-select" [class.multi-select--open]="open()">
      <button
        type="button"
        class="multi-select__control"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        [attr.aria-labelledby]="labelId"
        (click)="toggleOpen()"
        (keydown.escape)="close()"
      >
        <span class="multi-select__label" [id]="labelId">{{ label() }}</span>
        @if (selected().length === 0) {
          <span class="multi-select__value multi-select__value--placeholder">
            {{ placeholder() }}
          </span>
        } @else if (selected().length <= 2) {
          <span class="multi-select__value">{{ selectedLabels() }}</span>
        } @else {
          <span class="multi-select__value">{{ selected().length }} selected</span>
        }
        <svg
          class="multi-select__chevron"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            stroke-width="1.8"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      @if (open()) {
        <div
          class="multi-select__popover"
          role="listbox"
          [attr.aria-multiselectable]="true"
          [attr.aria-label]="label()"
        >
          @for (option of options(); track option.value) {
            <label class="multi-select__option">
              <input
                type="checkbox"
                [checked]="isSelected(option.value)"
                (change)="toggleOption(option.value)"
              />
              <span>{{ option.label }}</span>
            </label>
          } @empty {
            <p class="multi-select__empty">{{ emptyLabel() }}</p>
          }
          @if (selected().length > 0) {
            <button type="button" class="multi-select__clear" (click)="clear()">
              {{ clearLabel() }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .multi-select {
        position: relative;
      }

      .multi-select__control {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-2);
        height: 44px;
        padding: 0 var(--spacing-3);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        color: var(--color-text);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        cursor: pointer;
        transition:
          border-color var(--transition-duration) var(--transition-ease),
          background-color var(--transition-duration) var(--transition-ease);
        max-width: 260px;
      }

      .multi-select__control:hover {
        border-color: var(--color-primary);
      }

      .multi-select__control:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-focus-ring);
        border-color: var(--color-primary);
      }

      .multi-select--open .multi-select__control {
        border-color: var(--color-primary);
      }

      .multi-select__label {
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .multi-select__value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: var(--font-weight-medium);
      }

      .multi-select__value--placeholder {
        color: var(--color-text-muted);
        font-weight: var(--font-weight-normal);
      }

      .multi-select__chevron {
        flex-shrink: 0;
        color: var(--color-text-muted);
        transition: transform var(--transition-duration) var(--transition-ease);
      }

      .multi-select--open .multi-select__chevron {
        transform: rotate(180deg);
      }

      .multi-select__popover {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 50;
        min-width: 220px;
        max-height: 320px;
        overflow-y: auto;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        box-shadow: var(--elevation-light);
        padding: var(--spacing-2);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .multi-select__option {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-2);
        border-radius: calc(var(--radius-input) - 4px);
        font-size: var(--text-sm);
        color: var(--color-text);
        cursor: pointer;
        min-height: 36px;
      }

      .multi-select__option:hover {
        background: var(--color-surface-alt);
      }

      .multi-select__option input {
        accent-color: var(--color-primary-fill);
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .multi-select__empty {
        margin: 0;
        padding: var(--spacing-2);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }

      .multi-select__clear {
        margin-top: var(--spacing-1);
        padding: var(--spacing-2);
        background: transparent;
        border: none;
        border-top: 1px solid var(--color-border);
        color: var(--color-primary);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        border-radius: 0 0 calc(var(--radius-input) - 4px) calc(var(--radius-input) - 4px);
        min-height: 36px;
      }

      .multi-select__clear:hover {
        background: var(--color-primary-soft);
      }
    `,
  ],
})
export class MultiSelectComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly labelId = `ms-label-${Math.random().toString(36).slice(2, 9)}`;

  label = input.required<string>();
  options = input<MultiSelectOption[]>([]);
  selected = input<string[]>([]);
  placeholder = input('Any');
  emptyLabel = input('No options');
  clearLabel = input('Clear');

  selectionChange = output<string[]>();

  open = signal(false);

  selectedLabels = computed(() =>
    this.options()
      .filter((o) => this.selected().includes(o.value))
      .map((o) => o.label)
      .join(', '),
  );

  isSelected(value: string): boolean {
    return this.selected().includes(value);
  }

  toggleOpen(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  toggleOption(value: string): void {
    const current = this.selected();
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    this.selectionChange.emit(next);
  }

  clear(): void {
    this.selectionChange.emit([]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node;
    if (!this.host.nativeElement.contains(target)) {
      this.close();
    }
  }
}
