import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { niceTicks, spreadIndexes } from './chart-scale';

export type TrendPoint = {
  // Axis label (28 Oct) and tooltip title (Tue 28 Oct, or a week)
  short: string;
  label: string;
  value: number;
};

// Least height: the chart grows with its container when that one is taller
const MIN_HEIGHT = 240;
const PAD = { top: 26, right: 14, bottom: 30, left: 52 };
const MAX_BAR = 24;

// One series over time: an area (amounts) or columns (counts), in the primary color,
// filling its container (give it a height, or it takes the least one).
// A crosshair snaps to the nearest point under the pointer, or moves with the arrow
// keys once focused, and its tooltip gives the value. The peak is labeled on the chart,
// every value is in the hidden table for screen readers
@Component({
  selector: 'app-trend-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trend-chart.component.html',
  styleUrl: './trend-chart.component.scss',
})
export class TrendChartComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly points = input.required<TrendPoint[]>();
  readonly kind = input<'area' | 'column'>('area');
  readonly seriesLabel = input('');
  readonly format = input<(value: number) => string>(String);
  readonly axisFormat = input<(value: number) => string>(String);

  readonly pad = PAD;
  // Measured in the browser so the text keeps its size; a guess on the server
  readonly width = signal(720);
  readonly height = signal(MIN_HEIGHT);
  readonly active = signal<number | null>(null);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => {
        this.width.set(Math.max(Math.round(entry.contentRect.width), 240));
        this.height.set(Math.max(Math.round(entry.contentRect.height), MIN_HEIGHT));
      });
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  readonly plot = computed(() => ({
    left: PAD.left,
    top: PAD.top,
    width: this.width() - PAD.left - PAD.right,
    height: this.height() - PAD.top - PAD.bottom,
    bottom: this.height() - PAD.bottom,
  }));

  readonly ticks = computed(() =>
    niceTicks(Math.max(...this.points().map((p) => p.value), 0)),
  );

  private y = computed(() => {
    const { top, height } = this.plot();
    const max = this.ticks()[this.ticks().length - 1] || 1;
    return (value: number) => top + height * (1 - value / max);
  });

  // Columns sit in the middle of equal bands, area points span the whole width
  readonly band = computed(() => this.plot().width / Math.max(this.points().length, 1));

  private x = computed(() => {
    const { left, width } = this.plot();
    const n = this.points().length;
    if (this.kind() === 'column') return (i: number) => left + this.band() * (i + 0.5);
    return (i: number) => (n < 2 ? left + width / 2 : left + (width * i) / (n - 1));
  });

  readonly yTicks = computed(() =>
    this.ticks().map((value) => ({ value, y: this.y()(value), label: this.axisFormat()(value) })),
  );

  readonly xLabels = computed(() => {
    const n = this.points().length;
    const count = Math.max(2, Math.floor(this.plot().width / 90));
    return spreadIndexes(n, count).map((i) => ({
      x: this.x()(i),
      label: this.points()[i].short,
      anchor:
        this.kind() === 'area' && i === 0 ? 'start' : this.kind() === 'area' && i === n - 1 ? 'end' : 'middle',
    }));
  });

  readonly coords = computed(() =>
    this.points().map((p, i) => ({ x: this.x()(i), y: this.y()(p.value) })),
  );

  readonly linePath = computed(() =>
    this.coords()
      .map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' '),
  );

  readonly areaPath = computed(() => {
    const coords = this.coords();
    if (!coords.length) return '';
    const base = this.plot().bottom;
    return `${this.linePath()} L${coords[coords.length - 1].x.toFixed(1)},${base} L${coords[0].x.toFixed(1)},${base} Z`;
  });

  // Rounded on the data end, square on the baseline
  readonly bars = computed(() => {
    const base = this.plot().bottom;
    const width = Math.max(2, Math.min(MAX_BAR, this.band() - 2, this.band() * 0.62));
    return this.coords().map(({ x, y }) => {
      const height = base - y;
      const r = Math.min(4, height, width / 2);
      const left = x - width / 2;
      const right = x + width / 2;
      const d =
        height <= 0
          ? ''
          : `M${left},${base} V${y + r} Q${left},${y} ${left + r},${y} H${right - r} Q${right},${y} ${right},${y + r} V${base} Z`;
      return { d, x: left, width };
    });
  });

  // The highest point, labeled on the chart (none when everything is 0)
  readonly peak = computed(() => {
    const points = this.points();
    let best = -1;
    points.forEach((p, i) => {
      if (p.value > 0 && (best < 0 || p.value >= points[best].value)) best = i;
    });
    if (best < 0) return null;
    const { x, y } = this.coords()[best];
    const { left, width } = this.plot();
    // Kept inside the plot near its edges
    const anchor = x < left + 40 ? 'start' : x > left + width - 40 ? 'end' : 'middle';
    return { index: best, x, y, anchor, label: this.format()(points[best].value) };
  });

  readonly tooltip = computed(() => {
    const index = this.active();
    if (index == null || !this.points()[index]) return null;
    const point = this.points()[index];
    const { x, y } = this.coords()[index];
    return {
      x,
      y,
      // Flipped to the left of the crosshair on the right half
      flip: x > this.width() / 2,
      title: point.label,
      value: this.format()(point.value),
    };
  });

  onPointer(event: PointerEvent) {
    const n = this.points().length;
    if (!n) return;
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const px = event.clientX - rect.left;
    const { left, width } = this.plot();
    const index =
      this.kind() === 'column'
        ? Math.floor((px - left) / this.band())
        : Math.round(((px - left) / width) * (n - 1));
    this.active.set(Math.min(Math.max(index, 0), n - 1));
  }

  onKey(event: KeyboardEvent) {
    const n = this.points().length;
    if (!n) return;
    const current = this.active() ?? n - 1;
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: n - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    this.active.set(Math.min(Math.max(moves[event.key], 0), n - 1));
  }

  onFocus() {
    if (this.active() == null && this.points().length) {
      this.active.set(this.points().length - 1);
    }
  }
}
