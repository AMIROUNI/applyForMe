import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { SearchFilterBarComponent } from './search-filter-bar.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { emptyJobFilters } from '@shared';

describe('SearchFilterBarComponent', () => {
  let component: SearchFilterBarComponent;

  const mockI18n = {
    t: jasmine
      .createSpy('t')
      .and.returnValue(new Proxy({}, { get: (_target, key: string) => String(key) })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchFilterBarComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchFilterBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debounces query changes by 300ms and trims the value', fakeAsync(() => {
    spyOn(component.queryChange, 'emit');
    component.onQueryInput('  react  ');
    tick(200);
    expect(component.queryChange.emit).not.toHaveBeenCalled();
    tick(150);
    expect(component.queryChange.emit).toHaveBeenCalledWith('react');
  }));

  it('emits the draft filters when applying', () => {
    spyOn(component.filtersChange, 'emit');
    component.patchDraft({ countries: ['tn'], minScore: 70 });
    component.applyFilters();
    expect(component.filtersChange.emit).toHaveBeenCalledWith({
      ...emptyJobFilters(),
      countries: ['tn'],
      minScore: 70,
    });
  });

  it('counts active filters', () => {
    expect(component.activeFilterCount()).toBe(0);
    component.patchDraft({ countries: ['tn', 'fr'] });
    expect(component.activeFilterCount()).toBe(2);
    component.patchDraft({ datePosted: 'last-week' });
    expect(component.activeFilterCount()).toBe(3);
  });

  it('clears everything and emits empty state', fakeAsync(() => {
    spyOn(component.queryChange, 'emit');
    spyOn(component.filtersChange, 'emit');
    spyOn(component.clearAll, 'emit');

    component.onQueryInput('node');
    tick(300);
    component.patchDraft({ statuses: ['new'] });

    component.onClearAll();

    expect(component.queryDraft()).toBe('');
    expect(component.activeFilterCount()).toBe(0);
    expect(component.queryChange.emit).toHaveBeenCalledWith('');
    expect(component.filtersChange.emit).toHaveBeenCalledWith(emptyJobFilters());
    expect(component.clearAll.emit).toHaveBeenCalled();
  }));

  it('sets a single experience level from the select', () => {
    component.patchDraft({ experienceLevels: ['senior'] });
    expect(component.singleExperience()).toBe('senior');
  });
});
