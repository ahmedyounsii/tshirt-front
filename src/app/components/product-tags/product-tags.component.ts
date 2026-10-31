import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TagComponent } from '../tag/tag.component';
import {
  MAX_PRODUCT_TAGS,
  MAX_TAG_LENGTH,
  normalizeTag,
} from '../../models/product.model';

// Search tags of a product or a design, bound with [(tags)]: typing then Enter (or a comma) adds the tag
// as a chip above the input, MAX_PRODUCT_TAGS at most
@Component({
    selector: 'app-product-tags',
    imports: [TranslatePipe, TagComponent],
    templateUrl: './product-tags.component.html',
    styleUrl: './product-tags.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductTagsComponent {
  readonly tags = model<string[]>([]);
  readonly inputId = input('productTags');

  readonly max = MAX_PRODUCT_TAGS;
  readonly maxLength = MAX_TAG_LENGTH;
  readonly draft = signal('');
  readonly full = computed(() => this.tags().length >= MAX_PRODUCT_TAGS);

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      // Inside a form, Enter would submit it
      event.preventDefault();
      this.add();
    } else if (event.key === 'Backspace' && !this.draft() && this.tags().length) {
      this.remove(this.tags().length - 1);
    }
  }

  // Also on blur: a tag typed without Enter isn't lost when saving
  add() {
    const tag = normalizeTag(this.draft());
    this.draft.set('');
    if (!tag || this.full() || this.tags().includes(tag)) return;
    this.tags.set([...this.tags(), tag]);
  }

  remove(index: number) {
    this.tags.set(this.tags().filter((_, i) => i !== index));
  }
}
