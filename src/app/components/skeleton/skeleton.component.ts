import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

// Loading placeholder with a shimmer: the host itself is the box.
// Sized by width / height (or size for both), round with shape="circle".
// Colors can be overridden by the parent: --skeleton-bg, --skeleton-shine, --skeleton-radius
@Component({
    selector: 'app-skeleton',
    template: '',
    styleUrl: './skeleton.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
      '[class.circle]': "shape === 'circle'",
      '[style.width]': 'size || width',
      '[style.height]': 'size || height',
      '[style.border-radius]': 'borderRadius',
      '[attr.role]': "ariaLabel ? 'status' : null",
      '[attr.aria-label]': 'ariaLabel || null',
      '[attr.aria-hidden]': 'ariaLabel ? null : true',
    }
})
export class SkeletonComponent {
  @Input() width = '100%';
  @Input() height = '1rem';
  // Width and height at once (squares, circles)
  @Input() size?: string;
  @Input() shape: 'rectangle' | 'circle' = 'rectangle';
  @Input() borderRadius?: string;
  // Announced to screen readers; without it the placeholder is hidden from them
  @Input() ariaLabel = '';
}
