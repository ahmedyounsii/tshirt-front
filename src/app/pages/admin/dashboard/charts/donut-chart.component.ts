import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export type DonutSegment = {
  key: string;
  label: string;
  value: number;
  // Any CSS color, var(--sp-green-500)...
  color: string;
};

const SIZE = 176;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
// Surface gap between two segments, in px along the ring
const GAP = 2.5;

// Share of each part in a ring, the total in its middle. The segment hovered here, or
// named by `active` from the legend next to it, stands out
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + size + ' ' + size"
      [attr.width]="size"
      [attr.height]="size"
      aria-hidden="true"
    >
      <circle class="track" [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="r" />
      <g [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'">
        @for (arc of arcs(); track arc.key) {
          <circle
            class="arc"
            [class.dim]="active() && active() !== arc.key"
            [class.lift]="active() === arc.key"
            [attr.cx]="size / 2"
            [attr.cy]="size / 2"
            [attr.r]="r"
            [attr.stroke]="arc.color"
            [attr.stroke-dasharray]="arc.dash"
            [attr.stroke-dashoffset]="arc.offset"
            (pointerenter)="active.set(arc.key)"
            (pointerleave)="active.set(null)"
          />
        }
      </g>
    </svg>
    <div class="donut-center">
      <span class="donut-value">{{ centerValue() }}</span>
      <span class="donut-label">{{ centerLabel() }}</span>
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
    }

    svg {
      display: block;
      overflow: visible;
    }

    .track {
      fill: none;
      stroke: var(--sp-surface-100);
      stroke-width: ${STROKE};
    }

    .arc {
      fill: none;
      stroke-width: ${STROKE};
      cursor: pointer;
      transition:
        opacity 0.15s,
        stroke-width 0.15s;
    }

    .arc.dim {
      opacity: 0.35;
    }

    .arc.lift {
      stroke-width: ${STROKE + 6};
    }

    .donut-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      pointer-events: none;
      text-align: center;
    }

    .donut-value {
      font-size: 26px;
      font-weight: 800;
      line-height: 1;
      color: var(--sp-surface-950);
    }

    .donut-label {
      max-width: 110px;
      font-size: 12px;
      color: var(--sp-surface-500);
    }
  `,
})
export class DonutChartComponent {
  readonly segments = input.required<DonutSegment[]>();
  readonly centerValue = input<string | number>('');
  readonly centerLabel = input('');
  // Key of the highlighted segment, shared with the legend
  readonly active = model<string | null>(null);

  readonly size = SIZE;
  readonly r = R;

  readonly arcs = computed(() => {
    const parts = this.segments().filter((s) => s.value > 0);
    const total = parts.reduce((sum, s) => sum + s.value, 0);
    if (!total) return [];
    const gap = parts.length > 1 ? GAP : 0;
    let start = 0;
    return parts.map((part) => {
      const length = (part.value / total) * CIRCUMFERENCE;
      const visible = Math.max(length - gap, 0.5);
      const arc = {
        key: part.key,
        color: part.color,
        dash: `${visible} ${CIRCUMFERENCE - visible}`,
        offset: -start,
      };
      start += length;
      return arc;
    });
  });
}
