import {
  Component,
  computed,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PopoverComponent } from '../../popover/popover.component';
import {
  Language,
  LANGUAGES,
  LanguageService,
} from '../../../services/language.service';
import {
  BottomDrawerComponent,
  injectIsMobile,
} from '../../bottom-drawer/bottom-drawer.component';

interface LanguageOption {
  lang: Language;
  // Each language is named in itself, whatever the current one
  name: string;
  flag: string;
}

const NAMES: Record<Language, string> = { en: 'English', fr: 'Français' };

// Language menu of the header: the current flag opens the list of languages.
// The popover is appended to body, so its styles can't be encapsulated
// On mobile the same list opens in a bottom sheet instead of the popover
@Component({
    selector: 'app-header-language',
    imports: [
        NgTemplateOutlet,
        TranslatePipe,
        BottomDrawerComponent,
        PopoverComponent,
    ],
    encapsulation: ViewEncapsulation.None,
    template: `
    <button
      type="button"
      class="app-btn app-btn-sm app-btn-secondary app-btn-text language-trigger"
      (click)="toggle($event)"
      [attr.aria-label]="'language.menu' | translate"
    >
      <img
        class="language-flag"
        [src]="current().flag"
        [alt]="current().name"
        aria-hidden="true"
      />
      <span class="language-code">{{ current().lang }}</span>
    </button>
    <!-- Mobile: a bottom sheet; desktop: a popover. Both share the list template -->
    @if (isMobile()) {
      @if (sheetOpen()) {
        <app-bottom-drawer
          class="language-sheet"
          [ariaLabel]="'language.menu' | translate"
          (doClose)="sheetOpen.set(false)"
        >
          <ng-container [ngTemplateOutlet]="languageList" />
        </app-bottom-drawer>
      }
    } @else {
      <app-popover class="language-popover">
        <ng-container [ngTemplateOutlet]="languageList" />
      </app-popover>
    }
    <ng-template #languageList>
      <div
        class="language-list"
        role="group"
        [attr.aria-label]="'language.menu' | translate"
      >
        @for (option of options; track option.lang) {
          <button
            type="button"
            class="language-option"
            [attr.lang]="option.lang"
            [attr.aria-pressed]="language.current() === option.lang"
            (click)="select(option.lang)"
          >
            <img
              class="language-flag"
              [src]="option.flag"
              [alt]="option.name"
              aria-hidden="true"
            />
            <span class="language-name">{{ option.name }}</span>
            @if (language.current() === option.lang) {
              <i class="sp-icon sp-tick"></i>
            }
          </button>
        }
      </div>
    </ng-template>
  `,
    styles: `
    app-header-language {
      display: flex;
      align-items: center;
    }

    .language-trigger.app-btn {
      gap: 6px;
      padding: 0;
    }

    /* Extra class to outweigh the text button hover/active backgrounds */
    .language-trigger.app-btn-text:not(:disabled):hover,
    .language-trigger.app-btn-text:not(:disabled):active {
      background: transparent;
      border-color: transparent;
    }

    .language-flag {
      display: block;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      object-fit: contain;
    }

    .language-code {
      font-weight: 600;
      text-transform: uppercase;
    }

    .language-chevron {
      font-size: 0.65rem;
    }

    .language-popover {
      --popover-padding: 0;
    }

    .language-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 180px;
      padding: 0.375rem;
    }

    .language-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0.5rem 0.625rem;
      border: none;
      border-radius: var(--button-radius);
      background: none;
      color: var(--sp-surface-700);
      font: inherit;
      font-size: 0.875rem;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s;
    }

    .language-option:hover,
    .language-option:focus-visible {
      outline: none;
      background: var(--sp-surface-100);
    }

    .language-option[aria-pressed='true'] {
      color: var(--sp-primary-500);
      font-weight: 600;
    }

    .language-name {
      flex: 1;
    }

    .language-option i {
      font-size: 0.75rem;
    }

    /* Mobile bottom sheet: it already pads its sides, options get larger tap targets */
    .language-sheet .language-list {
      padding-inline: 0;
    }

    .language-sheet .language-option {
      padding-block: 0.8rem;
    }
  `
})
export class HeaderLanguageComponent {
  language = inject(LanguageService);
  readonly options: LanguageOption[] = LANGUAGES.map((lang) => ({
    lang,
    name: NAMES[lang],
    flag: `./assets/icons/languages/${lang}.svg`,
  }));
  readonly current = computed(
    () => this.options.find((o) => o.lang === this.language.current())!,
  );

  readonly isMobile = injectIsMobile();
  readonly sheetOpen = signal(false);
  private popover = viewChild(PopoverComponent);
  private sheet = viewChild(BottomDrawerComponent);

  toggle(event: Event) {
    if (!this.isMobile()) {
      this.popover()?.toggle(event);
    } else if (this.sheetOpen()) {
      this.sheet()?.close();
    } else {
      this.sheetOpen.set(true);
    }
  }

  select(lang: Language) {
    this.language.use(lang);
    if (this.isMobile()) this.sheet()?.close();
    else this.popover()?.hide();
  }
}
