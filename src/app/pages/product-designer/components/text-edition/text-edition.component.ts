import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SliderModule } from 'primeng/slider';
import { TextareaModule } from 'primeng/textarea';
import {
  designObject,
  TextAlign,
  TextStyleModel,
} from '../../../../models/design-object.model';
import { textColors, textFonts } from '../../../../shared/text-fonts';
import {
  hasTextShadow,
  TEXT_CURVE_LIMITS,
  TEXT_SHADOW_ANGLE_LIMITS,
  TEXT_SHADOW_BLUR_LIMITS,
  TEXT_SHADOW_DEFAULTS,
  TEXT_SHADOW_DISTANCE_LIMITS,
  TEXT_SHADOW_OPACITY_LIMITS,
  TEXT_STRETCH_LIMITS,
  TEXT_STROKE_LIMITS,
  TEXT_THICKNESS_LIMITS,
  TEXT_TRANSPARENT,
} from '../../../../shared/text-render';
import {
  DESIGN_FILTERS,
  DesignFilterType,
} from '../../../../shared/design-filters';
import { TextCanvasDirective } from '../../../../shared/text-canvas.directive';
import { ButtonModule } from 'primeng/button';
import { PanelHeaderComponent } from '../panel-header/panel-header.component';
import {
  EditSectionComponent,
  provideEditAccordion,
} from '../edit-section/edit-section.component';
import {
  FONT_SIZE_LIMITS,
  resizeAroundCenter,
} from '../../logic/designer-logic';
import { TranslatePipe } from '@ngx-translate/core';

type SliderId =
  | 'thickness'
  | 'fontSize'
  | 'letterSpacing'
  | 'strokeWidth'
  | 'curve'
  | 'stretchX'
  | 'stretchY'
  | 'shadowDistance'
  | 'shadowAngle'
  | 'shadowBlur'
  | 'shadowOpacity';
type ColorKey = 'color' | 'strokeColor' | 'shadowColor';

type SliderControl = {
  id: SliderId;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

const THICKNESS_CONTROL: SliderControl = {
  id: 'thickness',
  label: 'designer.thickness',
  unit: '',
  ...TEXT_THICKNESS_LIMITS,
  step: 0.5,
  defaultValue: 0,
};

const SIZE_CONTROL: SliderControl = {
  id: 'fontSize',
  label: 'designer.size',
  unit: 'px',
  ...FONT_SIZE_LIMITS,
  step: 1,
  defaultValue: 32,
};

const SPACING_CONTROL: SliderControl = {
  id: 'letterSpacing',
  label: 'designer.spacing',
  unit: 'px',
  min: -5,
  max: 30,
  step: 0.5,
  defaultValue: 0,
};

const STROKE_CONTROL: SliderControl = {
  id: 'strokeWidth',
  label: 'designer.strokeWidth',
  unit: 'px',
  ...TEXT_STROKE_LIMITS,
  step: 0.5,
  defaultValue: 0,
};

const CURVE_CONTROL: SliderControl = {
  id: 'curve',
  label: 'designer.curve',
  unit: '',
  ...TEXT_CURVE_LIMITS,
  step: 1,
  defaultValue: 0,
};

const STRETCH_X_CONTROL: SliderControl = {
  id: 'stretchX',
  label: 'designer.stretchX',
  unit: '%',
  ...TEXT_STRETCH_LIMITS,
  step: 1,
  defaultValue: 100,
};

const STRETCH_Y_CONTROL: SliderControl = {
  ...STRETCH_X_CONTROL,
  id: 'stretchY',
  label: 'designer.stretchY',
};

const SHADOW_CONTROLS: SliderControl[] = [
  {
    id: 'shadowDistance',
    label: 'designer.shadowDistance',
    unit: 'px',
    ...TEXT_SHADOW_DISTANCE_LIMITS,
    step: 1,
    defaultValue: 0,
  },
  {
    id: 'shadowAngle',
    label: 'designer.shadowAngle',
    unit: '°',
    ...TEXT_SHADOW_ANGLE_LIMITS,
    step: 1,
    defaultValue: TEXT_SHADOW_DEFAULTS.shadowAngle,
  },
  {
    id: 'shadowBlur',
    label: 'designer.shadowBlur',
    unit: 'px',
    ...TEXT_SHADOW_BLUR_LIMITS,
    step: 1,
    defaultValue: 0,
  },
  {
    id: 'shadowOpacity',
    label: 'designer.shadowOpacity',
    unit: '%',
    ...TEXT_SHADOW_OPACITY_LIMITS,
    step: 1,
    defaultValue: TEXT_SHADOW_DEFAULTS.shadowOpacity,
  },
];

// Value of a slider the text doesn't have yet
const SLIDER_FALLBACKS: Partial<Record<SliderId, number>> = {
  stretchX: 100,
  stretchY: 100,
  shadowAngle: TEXT_SHADOW_DEFAULTS.shadowAngle,
  shadowOpacity: TEXT_SHADOW_DEFAULTS.shadowOpacity,
};

// Outline width given when an outline color is picked without one
const DEFAULT_STROKE_WIDTH = 2;
// Shadow given when a shadow color is picked without one
const DEFAULT_SHADOW = { shadowDistance: 4, shadowBlur: 4 };

// Device pixels per editor pixel of the filter thumbnails: small, they are drawn again on each change
const FILTER_THUMB_RATIO = 0.5;

@Component({
    selector: 'app-text-edition',
    imports: [
        TranslatePipe,
        ButtonModule,
        NgClass,
        NgTemplateOutlet,
        PanelHeaderComponent,
        EditSectionComponent,
        FormsModule,
        SliderModule,
        TextareaModule,
        TextCanvasDirective,
    ],
    templateUrl: './text-edition.component.html',
    styleUrl: './text-edition.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[class.edit-mode]': 'isEditMode' },
    // In edit mode, joins the accordion of the design edition
    providers: [provideEditAccordion()]
})
export class TextEditionComponent implements OnChanges {
  // When set, the component edits this text object live instead of building a new one
  @Input() textObject: designObject | null = null;

  @Output() doClose = new EventEmitter<any>();
  @Output() doAddText = new EventEmitter<TextStyleModel>();
  // The font picker replaces the text config: the design edition hides its own sections meanwhile
  @Output() pickingFontChange = new EventEmitter<boolean>();

  fonts = textFonts;
  colors = textColors;
  transparent = TEXT_TRANSPARENT;
  aligns: TextAlign[] = ['left', 'center', 'right'];
  strokeControl = STROKE_CONTROL;
  curveControl = CURVE_CONTROL;
  shadowControls = SHADOW_CONTROLS;
  readonly filters = DESIGN_FILTERS;
  readonly filterThumbRatio = FILTER_THUMB_RATIO;

  draft: TextStyleModel = this.defaultStyle();

  pickingFont = false;
  // Put back when the picker is left without saving
  private fontBeforePicking = '';

  get isEditMode(): boolean {
    return !!this.textObject?.text;
  }

  get style(): TextStyleModel {
    return this.textObject?.text ?? this.draft;
  }

  // The stretch only once the text is placed
  get fontControls(): SliderControl[] {
    return this.isEditMode
      ? [
          SIZE_CONTROL,
          STRETCH_X_CONTROL,
          STRETCH_Y_CONTROL,
          THICKNESS_CONTROL,
          SPACING_CONTROL,
        ]
      : [SIZE_CONTROL, THICKNESS_CONTROL, SPACING_CONTROL];
  }

  defaultStyle(): TextStyleModel {
    return {
      content: '',
      fontFamily: textFonts[0],
      fontSize: 32,
      color: '#000000',
      bold: false,
      italic: false,
      underline: false,
      align: 'center',
      letterSpacing: 0,
      thickness: 0,
      strokeWidth: 0,
      strokeColor: '#000000',
      curve: 0,
    };
  }

  // Most changes resize the text: while editing, around its center like the resize button,
  // so the text doesn't move
  private update(change: () => void) {
    const object = this.textObject;
    if (object && this.isEditMode) resizeAroundCenter(object, change);
    else change();
  }

  toggle(key: 'bold' | 'italic' | 'underline') {
    this.update(() => (this.style[key] = !this.style[key]));
  }

  valueOf(id: SliderId): number {
    return this.style[id] ?? SLIDER_FALLBACKS[id] ?? 0;
  }

  // The resize button leaves a font size with decimals
  displayValue(id: SliderId): number {
    return Math.round(this.valueOf(id) * 10) / 10;
  }

  setValue(id: SliderId, value: number) {
    if (value == null || Number.isNaN(value)) return;
    this.update(() => (this.style[id] = value));
  }

  colorOf(key: ColorKey): string {
    return this.style[key] ?? '#000000';
  }

  setColor(key: ColorKey, color: string) {
    this.update(() => {
      this.style[key] = color;
      // Picking an outline or shadow color shows it, as do transparent letters
      // (they are only their outline)
      const showsOutline =
        key === 'strokeColor' || (key === 'color' && color === TEXT_TRANSPARENT);
      if (showsOutline && !this.style.strokeWidth) {
        this.style.strokeWidth = DEFAULT_STROKE_WIDTH;
      }
      if (key === 'shadowColor' && !hasTextShadow(this.style)) {
        Object.assign(this.style, DEFAULT_SHADOW, {
          shadowOpacity: this.style.shadowOpacity || TEXT_SHADOW_DEFAULTS.shadowOpacity,
        });
      }
    });
  }

  get filterType(): DesignFilterType {
    return this.style.filter ?? 'none';
  }

  setFilter(type: DesignFilterType) {
    this.update(() => (this.style.filter = type));
  }

  // The text under each filter, for the thumbnails. Same objects while the text doesn't change
  private thumbsKey = '';
  private thumbs: Partial<Record<DesignFilterType, TextStyleModel>> = {};
  filterThumb(type: DesignFilterType): TextStyleModel {
    const key = JSON.stringify(this.style);
    if (key !== this.thumbsKey) {
      this.thumbsKey = key;
      this.thumbs = {};
    }
    return (this.thumbs[type] ??= { ...this.style, filter: type });
  }

  // Shown on the font cards: the text itself, or Aa while there is none
  get fontSample(): string {
    return this.style.content.trim().split('\n')[0] || 'Aa';
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Another text (or its copy after an undo): the design edition shows its sections again
    if (changes['textObject'] && !changes['textObject'].firstChange) {
      this.pickingFont = false;
    }
  }

  openFontPicker() {
    this.fontBeforePicking = this.style.fontFamily;
    this.setPickingFont(true);
  }

  // Shown on the text right away, kept only once saved
  pickFont(font: string) {
    this.setFont(font);
  }

  cancelFontPicker() {
    this.setFont(this.fontBeforePicking);
    this.setPickingFont(false);
  }

  saveFontPicker() {
    this.setPickingFont(false);
  }

  private setFont(font: string) {
    this.update(() => (this.style.fontFamily = font));
  }

  private setPickingFont(picking: boolean) {
    this.pickingFont = picking;
    this.pickingFontChange.emit(picking);
  }

  addText() {
    if (!this.draft.content.trim()) return;
    this.doAddText.emit({ ...this.draft });
    // Keep the chosen style so the next text can be typed right away
    this.draft = { ...this.draft, content: '' };
  }
}
