import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

// Native range input: a thick track filled up to the value, a ring handle in the primary color
@Component({
    selector: 'app-slider',
    templateUrl: './slider.component.html',
    styleUrl: './slider.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
      '[style.--slider-fill]': 'fill + "%"',
    }
})
export class SliderComponent {
  @Input() value = 0;
  @Input() min = 0;
  @Input() max = 100;
  @Input() step = 1;
  @Input() ariaLabel = '';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<number>();

  // Filled part of the track, in percent
  get fill(): number {
    const range = this.max - this.min;
    if (range <= 0) return 0;
    return Math.min(100, Math.max(0, ((this.value - this.min) / range) * 100));
  }

  onInput(event: Event) {
    this.valueChange.emit(+(event.target as HTMLInputElement).value);
  }
}
