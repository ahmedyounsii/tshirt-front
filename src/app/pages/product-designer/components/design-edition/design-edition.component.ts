import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { SliderComponent } from '../../../../components/slider/slider.component';
import { designObject } from '../../../../models/design-object.model';
import { TextEditionComponent } from '../text-edition/text-edition.component';
import { TranslatePipe } from '@ngx-translate/core';
import {
  applyDesignFilter,
  DESIGN_FILTERS,
  DesignFilterType,
} from '../../../../shared/design-filters';
import {
  boxWithLongestSide,
  FONT_SIZE_LIMITS,
  IMAGE_SIZE_LIMITS,
  resizeAroundCenter,
} from '../../logic/designer-logic';
import { TagComponent } from '../../../../components/tag/tag.component';
import {
  EditSectionComponent,
  provideEditAccordion,
} from '../edit-section/edit-section.component';

type ControlId = 'translateX' | 'translateY' | 'rotate' | 'scale';
// Mobile tools that open a control above the toolbar
type ToolId = ControlId | 'filter';

type SliderControl = {
  id: ControlId;
  label: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

// Longest side of the filter thumbnails
const FILTER_PREVIEW_SIZE = 160;

const CONTROLS: SliderControl[] = [
  {
    id: 'translateX',
    label: 'designer.translateX',
    icon: 'pi-arrows-h',
    unit: 'px',
    min: -300,
    max: 300,
    step: 1,
    defaultValue: 0,
  },
  {
    id: 'translateY',
    label: 'designer.translateY',
    icon: 'pi-arrows-v',
    unit: 'px',
    min: -300,
    max: 300,
    step: 1,
    defaultValue: 0,
  },
  {
    id: 'rotate',
    label: 'designer.rotation',
    icon: 'pi-refresh',
    unit: '°',
    min: -180,
    max: 180,
    step: 1,
    defaultValue: 0,
  },
];

// Size of an image: its longest side, 100 when added
const IMAGE_SIZE_CONTROL: SliderControl = {
  id: 'scale',
  label: 'designer.scale',
  icon: 'pi-arrow-up-right-and-arrow-down-left-from-center',
  unit: '%',
  ...IMAGE_SIZE_LIMITS,
  step: 1,
  defaultValue: 100,
};

const TEXT_SIZE_CONTROL: SliderControl = {
  id: 'scale',
  label: 'designer.fontSize',
  icon: 'pi-arrow-up-right-and-arrow-down-left-from-center',
  unit: 'px',
  ...FONT_SIZE_LIMITS,
  step: 1,
  defaultValue: 32,
};

@Component({
    selector: 'app-design-edition',
    imports: [
        EditSectionComponent,
        TagComponent,
        TranslatePipe,
        NgClass,
        NgTemplateOutlet,
        SliderComponent,
        TextEditionComponent,
    ],
    templateUrl: './design-edition.component.html',
    styleUrl: './design-edition.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    // Shared with the text sections, so one section is open in the whole panel
    providers: [provideEditAccordion()]
})
export class DesignEditionComponent implements OnChanges {
  private cdr = inject(ChangeDetectorRef);

  @Input() selectedDesign!: designObject;
  // Passed so a drag on the canvas refreshes the panel (OnPush)
  @Input() selectedDesignLeft: any;
  @Input() selectedDesignTop: any;
  @Input() selectedDesignWidth: any;
  @Input() selectedDesignRotation: any;
  @Output() doRemove = new EventEmitter<void>();
  @Output() doDuplicate = new EventEmitter<void>();
  // Editing is over: unselect the object
  @Output() doDone = new EventEmitter<void>();
  // The selected image now shows its new filter
  @Output() doFilterApplied = new EventEmitter<void>();

  controls: SliderControl[] = [];

  // The text edition shows its font picker in place of the sections
  pickingFont = false;

  // Mobile: tool whose control is open above the toolbar
  activeTool: ToolId | null = null;
  // Value of the active slider when it was opened, put back on cancel
  private valueBeforeTool: number | null = null;

  readonly filters = DESIGN_FILTERS;
  // Filter picked, shown as active while it renders
  filterType: DesignFilterType = 'none';
  filtering = false;
  // Bumped on each request, so a slower earlier render doesn't win
  private filterRun = 0;

  // Thumbnail of the design under each filter
  filterPreviews: Partial<Record<DesignFilterType, string>> = {};
  private previewSource?: string;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDesign']) {
      // The text edition starts again without its picker
      this.pickingFont = false;
      this.controls = [
        ...CONTROLS,
        this.isText ? TEXT_SIZE_CONTROL : IMAGE_SIZE_CONTROL,
      ];
      // Another object (or its copy after an undo): drop what was rendering for the previous one
      this.filterRun++;
      this.filtering = false;
      if (this.activeTool === 'filter' && !this.canFilter) {
        this.activeTool = null;
      }
      this.loadFilterPreviews();
    }
    if (!this.filtering) {
      this.filterType = this.selectedDesign.filter?.type ?? 'none';
    }
  }

  get isText(): boolean {
    return this.selectedDesign.type === 'text';
  }

  get canFilter(): boolean {
    return !this.isText && !!this.originalUrl;
  }

  // Desktop: a text's size is in the font section of the text edition
  get transformControls(): SliderControl[] {
    return this.isText
      ? this.controls.filter((c) => c.id !== 'scale')
      : this.controls;
  }

  get activeControl(): SliderControl | undefined {
    return this.controls.find((c) => c.id === this.activeTool);
  }

  // The filter always starts from the original image
  private get originalUrl(): string | undefined {
    return this.selectedDesign.design?.url;
  }

  toggleTool(tool: ToolId) {
    this.activeTool = this.activeTool === tool ? null : tool;
    const control = this.activeControl;
    if (control) this.valueBeforeTool = this.valueOf(control.id);
  }

  // Mobile: close the slider and put back the value it had when opened
  cancelTool() {
    const control = this.activeControl;
    if (control && this.valueBeforeTool !== null) {
      this.setValue(control.id, this.valueBeforeTool);
    }
    this.activeTool = null;
  }

  valueOf(id: ControlId): number {
    const design = this.selectedDesign;
    switch (id) {
      case 'translateX':
        return design.left;
      case 'translateY':
        return design.top;
      case 'rotate':
        return design.rotation;
      case 'scale':
        return this.isText && design.text
          ? design.text.fontSize
          : Math.max(design.width, design.height);
    }
  }

  setValue(id: ControlId, value: number) {
    if (value == null || Number.isNaN(value)) return;
    const design = this.selectedDesign;
    switch (id) {
      case 'translateX':
        design.left = value;
        break;
      case 'translateY':
        design.top = value;
        break;
      case 'rotate':
        design.rotation = value;
        break;
      case 'scale':
        // Around its center, like the resize button: the object doesn't move
        resizeAroundCenter(design, () => {
          if (this.isText && design.text) {
            design.text.fontSize = value;
            return;
          }
          // Both sides scaled, so the image keeps its ratio
          Object.assign(design, boxWithLongestSide(design, value));
        });
    }
  }

  displayValue(control: SliderControl): number {
    return Math.round(this.valueOf(control.id));
  }

  isDefault(control: SliderControl): boolean {
    return this.displayValue(control) === control.defaultValue;
  }

  resetControl(control: SliderControl) {
    this.setValue(control.id, control.defaultValue);
  }

  selectFilter(type: DesignFilterType) {
    if (type === this.filterType) return;
    this.filterType = type;
    this.applyFilter();
  }

  private loadFilterPreviews() {
    const source = this.originalUrl;
    if (!this.canFilter || !source || source === this.previewSource) return;
    this.previewSource = source;
    this.filterPreviews = { none: source };
    for (const type of this.filters) {
      if (type === 'none') continue;
      applyDesignFilter(source, { type }, FILTER_PREVIEW_SIZE)
        .then((url) => {
          if (this.previewSource !== source) return;
          this.filterPreviews = { ...this.filterPreviews, [type]: url };
          this.cdr.markForCheck();
        })
        .catch((err) => console.error('Failed to preview the filter', err));
    }
  }

  private async applyFilter() {
    const design = this.selectedDesign;
    const source = this.originalUrl;
    if (!source) return;
    const run = ++this.filterRun;
    const filter =
      this.filterType === 'none' ? undefined : { type: this.filterType };
    this.filtering = true;
    this.cdr.markForCheck();
    try {
      const url = filter ? await applyDesignFilter(source, filter) : source;
      if (run !== this.filterRun) return;
      // Both at once: the undo history never sees a filter without its image
      design.filter = filter;
      design.url = url;
      this.doFilterApplied.emit();
    } catch (err) {
      console.error('Failed to apply the filter', err);
      if (run === this.filterRun) {
        this.filterType = design.filter?.type ?? 'none';
      }
    } finally {
      if (run === this.filterRun) {
        this.filtering = false;
        this.cdr.markForCheck();
      }
    }
  }

  flipItemX() {
    this.selectedDesign.flipX = !this.selectedDesign.flipX;
  }

  flipItemY() {
    this.selectedDesign.flipY = !this.selectedDesign.flipY;
  }

  centerItem() {
    const canvas = document.getElementById('canvas') as HTMLElement;
    const canvasRect = canvas.getBoundingClientRect();
    // Text objects are auto-sized, so measure the rendered element
    const element = document.getElementById(this.selectedDesign.id);
    const width =
      this.isText && element ? element.offsetWidth : this.selectedDesign.width;
    const centerX = (canvasRect.width - width) / 2;
    let padding = 0;
    Math.round(width) % 2 === 0 ? (padding = 2) : (padding = 3);
    this.selectedDesign.left = centerX - padding;
  }
}
