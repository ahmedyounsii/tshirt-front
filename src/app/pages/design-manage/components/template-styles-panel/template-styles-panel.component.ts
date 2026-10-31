import { Component, computed, EventEmitter, inject, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  LocalizedText,
  TemplateStyle,
  TemplateStylePayload,
} from '../../../../models/template-style.model';
import { TemplateStylesService } from '../../../../services/template-styles/template-styles.service';
import { TemplatesService } from '../../../../services/templates/templates.service';
import { ConfirmService } from '../../../../services/confirm/confirm.service';
import { AdminToast } from '../admin-toast/admin-toast.component';

// The type field: an existing type, or a new one named in typeNames
const NEW_TYPE = '';

const emptyText = (): LocalizedText => ({ en: '', fr: '' });

type Draft = {
  type: string;
  names: LocalizedText;
  typeNames: LocalizedText;
  hints: LocalizedText;
};

// Admin: the template styles the shop sells (the designer's types and styles, each with its
// own price): add, rename, reorder, remove
@Component({
    selector: 'app-template-styles-panel',
    imports: [TranslatePipe, FormsModule, ButtonModule, InputTextModule],
    templateUrl: './template-styles-panel.component.html',
    styleUrl: './template-styles-panel.component.scss'
})
export class TemplateStylesPanelComponent {
  private stylesService = inject(TemplateStylesService);
  private templatesService = inject(TemplatesService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

  @Output() closed = new EventEmitter<void>();
  @Output() notify = new EventEmitter<AdminToast>();

  readonly styles = this.stylesService.styles;
  readonly groups = this.stylesService.groups;
  readonly loaded = this.stylesService.loaded;
  readonly newType = NEW_TYPE;

  // The form: 'new', the key of the style being edited, or closed (null)
  editing = signal<string | 'new' | null>(null);
  draft: Draft = this.emptyDraft();
  busy = signal(false);

  // Templates per style: a style can only be removed once it has none
  readonly templateCounts = computed(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const t of this.templatesService.templates()) {
      if (t.style) counts[t.style] = (counts[t.style] ?? 0) + 1;
    }
    return counts;
  });

  get canSave(): boolean {
    const d = this.draft;
    return (
      !this.busy() &&
      !!d.names.en.trim() &&
      !!d.names.fr.trim() &&
      !!d.typeNames.en.trim() &&
      !!d.typeNames.fr.trim()
    );
  }

  openNew() {
    this.draft = this.emptyDraft();
    this.editing.set('new');
  }

  edit(style: TemplateStyle) {
    this.draft = {
      type: style.type,
      names: { ...style.names },
      typeNames: { ...style.typeNames },
      hints: { ...style.hints },
    };
    this.editing.set(style.key);
  }

  // An existing type comes with its names (editing them renames it on every style)
  selectType(type: string) {
    this.draft.type = type;
    const group = this.groups().find((g) => g.type === type);
    this.draft.typeNames = group ? { ...group.styles[0].typeNames } : emptyText();
  }

  // A new type named like the style: the usual case for a single-style type ("Hoodie")
  copyNameToType() {
    if (this.draft.type !== NEW_TYPE) return;
    this.draft.typeNames = { ...this.draft.names };
  }

  save() {
    if (!this.canSave) return;
    const editing = this.editing();
    const payload: TemplateStylePayload = {
      type: this.draft.type || undefined,
      names: this.draft.names,
      typeNames: this.draft.typeNames,
      hints: this.draft.hints,
    };
    const request =
      editing && editing !== 'new'
        ? this.stylesService.update(editing, payload)
        : this.stylesService.create(payload);
    this.run(request, editing === 'new' ? 'created' : 'updated', () => {
      this.editing.set(null);
      // Template names follow their style
      if (editing !== 'new') this.templatesService.refresh();
    });
  }

  move(style: TemplateStyle, offset: -1 | 1) {
    const keys = this.styles().map((s) => s.key);
    const from = keys.indexOf(style.key);
    const to = from + offset;
    if (to < 0 || to >= keys.length) return;
    [keys[from], keys[to]] = [keys[to], keys[from]];
    // Templates are listed in the styles' order
    this.run(this.stylesService.reorder(keys), null, () => this.templatesService.refresh());
  }

  async remove(style: TemplateStyle) {
    if (this.busy()) return;
    const name = this.translate.instant(`templates.styles.${style.key}`);
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('admin.templateStyles.deleteMessage', { name }),
      this.translate.instant('admin.templateStyles.delete'),
    );
    if (!ok) return;
    this.run(this.stylesService.delete(style.key), 'deleted', () => {
      if (this.editing() === style.key) this.editing.set(null);
    });
  }

  private run(request: Observable<unknown>, done: string | null, then: () => void) {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        then();
        if (done) {
          this.notify.emit({
            type: 'success',
            message: this.translate.instant(`admin.templateStyles.${done}`),
          });
        }
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        const key =
          error.status === 409
            ? done === 'deleted'
              ? 'admin.templateStyles.inUse'
              : 'admin.templateStyles.duplicate'
            : 'admin.templateStyles.saveFailed';
        this.notify.emit({ type: 'error', message: this.translate.instant(key) });
      },
    });
  }

  private emptyDraft(): Draft {
    return {
      type: this.groups()[0]?.type ?? NEW_TYPE,
      names: emptyText(),
      typeNames: this.groups()[0] ? { ...this.groups()[0].styles[0].typeNames } : emptyText(),
      hints: emptyText(),
    };
  }
}
