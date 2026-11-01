import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SliderComponent } from '../../../../components/slider/slider.component';
import {
  designObject,
  ShapeStyleModel,
} from '../../../../models/design-object.model';
import { textColors } from '../../../../shared/text-fonts';
import {
  DEFAULT_SHAPE_STROKE,
  SHAPE_STROKE_LIMITS,
  SHAPE_TRANSPARENT,
  shapeUrl,
} from '../../../../shared/shapes';
import {
  EditSectionComponent,
  provideEditAccordion,
} from '../edit-section/edit-section.component';

type ColorKey = 'fill' | 'strokeColor';

// Fill and outline of the selected shape, edited live: its image is generated again on each change
@Component({
  selector: 'app-shape-edition',
  imports: [
    TranslatePipe,
    NgClass,
    NgTemplateOutlet,
    FormsModule,
    EditSectionComponent,
    SliderComponent,
  ],
  templateUrl: './shape-edition.component.html',
  styleUrl: './shape-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Joins the accordion of the design edition
  providers: [provideEditAccordion()],
})
export class ShapeEditionComponent {
  @Input({ required: true }) shapeObject!: designObject;

  colors = textColors;
  transparent = SHAPE_TRANSPARENT;
  strokeLimits = SHAPE_STROKE_LIMITS;

  get style(): ShapeStyleModel {
    return this.shapeObject.shape!;
  }

  get strokeWidth(): number {
    return this.style.strokeWidth ?? 0;
  }

  colorOf(key: ColorKey): string {
    return this.style[key] ?? '#000000';
  }

  setColor(key: ColorKey, color: string) {
    const change: Partial<ShapeStyleModel> = { [key]: color };
    // Picking an outline color shows it, as does a transparent fill (only the outline is left)
    const showsOutline =
      key === 'strokeColor' || (key === 'fill' && color === SHAPE_TRANSPARENT);
    if (showsOutline && !this.strokeWidth) change.strokeWidth = DEFAULT_SHAPE_STROKE;
    this.update(change);
  }

  setStrokeWidth(value: number) {
    if (value == null || Number.isNaN(value)) return;
    this.update({ strokeWidth: value });
  }

  // A new style object: the undo history keeps the previous one
  private update(change: Partial<ShapeStyleModel>) {
    const shape = { ...this.style, ...change };
    this.shapeObject.shape = shape;
    this.shapeObject.url = shapeUrl(shape);
  }
}
