import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TagComponent, TagSize } from '../../components/tag/tag.component';
import { DiscountsService } from '../../services/discounts/discounts.service';
import { discountBadge } from '../../models/discount.model';

// "-20% on this collection" while a live discount is made on the collection; nothing otherwise.
// short: "Sale -20%", for the cards
@Component({
    selector: 'app-collection-sale',
    imports: [TranslatePipe, TagComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[style.display]': "sale() ? 'contents' : 'none'" },
    template: `
    @if (sale(); as discount) {
      <app-tag class="collection-sale" variant="danger" [size]="size()" icon="pi pi-percentage">
        {{
          (short() ? 'collectionSale.short' : 'collectionSale.long')
            | translate: { badge: badge(discount) }
        }}
      </app-tag>
    }
  `,
    styles: `
    .collection-sale {
      --tag-color: #fff;
      --tag-background: var(--sale-color, var(--p-red-500));
      --tag-border-color: transparent;
      --tag-icon-color: #fff;
    }
  `
})
export class CollectionSaleComponent {
  private discounts = inject(DiscountsService);

  readonly collectionId = input.required<string | null | undefined>();
  readonly size = input<TagSize>('md');
  readonly short = input(false);

  readonly sale = computed(() => this.discounts.collectionSale(this.collectionId()));
  readonly badge = discountBadge;
}
