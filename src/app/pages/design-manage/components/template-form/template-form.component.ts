import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TemplateModel, TemplatePayload } from '../../../../models/template.model';
import { ProductStyle } from '../../../../models/pricing.model';
import {
  TemplateImageChange,
  TemplatesService,
} from '../../../../services/templates/templates.service';
import { TemplateImagePipe } from '../../../../shared/template-image.pipe';
import { ImagePickerComponent } from '../image-picker/image-picker.component';
import { AdminToast } from '../admin-toast/admin-toast.component';

export type TemplateKind = 't-shirt' | 'sweatshirt';
export const TSHIRT_STYLES: ProductStyle[] = ['regular', 'oversize', 'washed'];

// Usual colors, one click fills the name and the swatch; their names are translated
const COLOR_PRESETS = [
  { label: 'white', color: '#ffffff' },
  { label: 'black', color: '#000000' },
  { label: 'beige', color: '#d8c8b0' },
  { label: 'gray', color: '#c2c2c2' },
  { label: 'navy', color: '#00013b' },
  { label: 'burgundy', color: '#4b0000' },
  { label: 'green', color: '#004b0a' },
  { label: 'mustard', color: '#e1ad01' },
];

const HEX = /^#[0-9a-f]{6}$/i;

// Same as the server: lowercase, single spaces
const normalizeColor = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ');

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ImagePickerComponent,
    TemplateImagePipe,
  ],
  templateUrl: './template-form.component.html',
  styleUrl: './template-form.component.scss',
})
export class TemplateFormComponent implements OnInit {
  private templatesService = inject(TemplatesService);
  private translate = inject(TranslateService);

  // Edited template, null to create one
  @Input() template: TemplateModel | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<TemplateModel>();
  @Output() notify = new EventEmitter<AdminToast>();

  readonly kinds: TemplateKind[] = ['t-shirt', 'sweatshirt'];
  readonly tshirtStyles = TSHIRT_STYLES;
  readonly presets = COLOR_PRESETS;

  kind: TemplateKind = 't-shirt';
  tshirtStyle: ProductStyle = 'regular';
  colorLabel = '';
  color = '#ffffff';
  front: File | null = null;
  back: File | null = null;
  // Edit only: the current back is dropped on save
  removeBack = false;
  saving = false;

  get style(): ProductStyle {
    return this.kind === 'sweatshirt' ? 'sweatshirt' : this.tshirtStyle;
  }

  get normalizedColor(): string {
    return normalizeColor(this.colorLabel);
  }

  get validHex(): boolean {
    return HEX.test(this.color);
  }

  get duplicate(): boolean {
    const label = this.normalizedColor;
    return this.templatesService
      .templates()
      .some((t) => t.id !== this.template?.id && t.style === this.style && t.colorLabel === label);
  }

  get hasFront(): boolean {
    return !!this.front || !!this.template?.frontImg;
  }

  get canSave(): boolean {
    return (
      !!this.normalizedColor && this.validHex && this.hasFront && !this.duplicate && !this.saving
    );
  }

  // The current images, shown until replaced
  get currentFront(): string | null {
    return this.front ? null : (this.template?.frontImg ?? null);
  }

  get currentBack(): string | null {
    if (this.back || this.removeBack) return null;
    return this.template?.backImg ?? null;
  }

  ngOnInit(): void {
    const t = this.template;
    if (!t) return;
    this.kind = t.type === 'sweatshirt' ? 'sweatshirt' : 't-shirt';
    if (t.style && TSHIRT_STYLES.includes(t.style as ProductStyle)) {
      this.tshirtStyle = t.style as ProductStyle;
    }
    this.colorLabel = t.colorLabel;
    this.color = HEX.test(t.color) ? t.color : '#ffffff';
  }

  pickPreset(preset: (typeof COLOR_PRESETS)[number]) {
    this.colorLabel = preset.label;
    this.color = preset.color;
  }

  isPreset(preset: (typeof COLOR_PRESETS)[number]): boolean {
    return this.normalizedColor === preset.label;
  }

  // The hex field: "#" is optional while typing
  onHexInput(value: string) {
    const hex = value.trim();
    this.color = hex.startsWith('#') ? hex : `#${hex}`;
  }

  onBackChange(file: File | null) {
    this.back = file;
    if (file) this.removeBack = false;
  }

  save() {
    if (!this.canSave) return;
    const payload: TemplatePayload = {
      style: this.style,
      colorLabel: this.normalizedColor,
      color: this.color.toLowerCase(),
    };
    const back: TemplateImageChange = this.back ?? (this.removeBack ? 'remove' : null);
    const request = this.template
      ? this.templatesService.update(this.template.id, payload, this.front, back)
      : this.templatesService.create(payload, this.front!, this.back);

    this.saving = true;
    request.subscribe({
      next: (template) => {
        this.saving = false;
        this.notify.emit({
          type: 'success',
          message: this.translate.instant(
            this.template ? 'admin.templates.updated' : 'admin.templates.created',
          ),
        });
        this.saved.emit(template);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        const key =
          error.status === 409 ? 'admin.templates.duplicate' : 'admin.templates.saveFailed';
        this.notify.emit({ type: 'error', message: this.translate.instant(key) });
      },
    });
  }
}
