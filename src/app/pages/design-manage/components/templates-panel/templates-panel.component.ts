import { Component, computed, EventEmitter, inject, OnInit, Output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TemplateModel } from '../../../../models/template.model';
import { PRODUCT_STYLES, ProductStyle } from '../../../../models/pricing.model';
import { TemplatesService } from '../../../../services/templates/templates.service';
import { ConfirmService } from '../../../../services/confirm/confirm.service';
import { TemplateImagePipe } from '../../../../shared/template-image.pipe';
import { EmptyComponent } from '../../../../components/empty/empty.component';
import { TemplateFormComponent } from '../template-form/template-form.component';
import { AdminToast } from '../admin-toast/admin-toast.component';

type StyleFilter = ProductStyle | 'all';

@Component({
  selector: 'app-templates-panel',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    SkeletonModule,
    TemplateImagePipe,
    EmptyComponent,
    TemplateFormComponent,
  ],
  templateUrl: './templates-panel.component.html',
  styleUrl: './templates-panel.component.scss',
})
export class TemplatesPanelComponent implements OnInit {
  private templatesService = inject(TemplatesService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

  @Output() notify = new EventEmitter<AdminToast>();

  readonly templates = this.templatesService.templates;
  readonly loaded = this.templatesService.loaded;
  readonly filters: StyleFilter[] = ['all', ...PRODUCT_STYLES];

  filter = signal<StyleFilter>('all');
  // The form: 'new', a template being edited, or closed (null)
  editing = signal<TemplateModel | 'new' | null>(null);
  deletingId = signal<string | null>(null);

  readonly counts = computed(() => {
    const counts: Record<StyleFilter, number> = { all: this.templates().length } as any;
    for (const style of PRODUCT_STYLES) {
      counts[style] = this.templates().filter((t) => t.style === style).length;
    }
    return counts;
  });

  readonly shown = computed(() => {
    const filter = this.filter();
    return filter === 'all'
      ? this.templates()
      : this.templates().filter((t) => t.style === filter);
  });

  ngOnInit(): void {
    this.templatesService.load().subscribe();
  }

  // The form instance is recreated for each template
  formTemplate(): TemplateModel | null {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  }

  openNew() {
    this.editing.set('new');
  }

  edit(template: TemplateModel) {
    this.editing.set(template);
  }

  async remove(template: TemplateModel) {
    if (this.deletingId()) return;
    const name = this.nameOf(template);
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('admin.templates.deleteMessage', { name }),
      this.translate.instant('admin.templates.delete'),
    );
    if (!ok) return;

    this.deletingId.set(template.id);
    this.templatesService.delete(template.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        const editing = this.editing();
        if (editing !== 'new' && editing?.id === template.id) this.editing.set(null);
        this.notify.emit({
          type: 'success',
          message: this.translate.instant('admin.templates.deleted', { name }),
        });
      },
      error: () => {
        this.deletingId.set(null);
        this.notify.emit({
          type: 'error',
          message: this.translate.instant('admin.templates.deleteFailed'),
        });
      },
    });
  }

  // "T-shirt Oversize · Black", in the current language
  nameOf(t: TemplateModel): string {
    const type = this.translate.instant(`templates.styles.${t.type}`);
    const style =
      t.type === 'sweatshirt' ? '' : ` ${this.translate.instant(`templates.styles.${t.style}`)}`;
    const color = this.translate.instant(`templates.colors.${t.colorLabel}`);
    return `${type}${style} · ${color}`;
  }
}
