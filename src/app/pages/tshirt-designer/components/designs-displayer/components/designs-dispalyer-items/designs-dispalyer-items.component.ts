import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CategoriesService } from '../../../../../../services/categories/categories.service';
import { DesignModel } from '../../../../../../models/design.model';
import { SkeletonModule } from 'primeng/skeleton';
import { delay } from 'rxjs';
import { DesignsObjectService } from '../../../../../../services/selected-design.service';
import { PaginatorModule } from 'primeng/paginator';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../../../environments/environment';
@Component({
  selector: 'app-designs-dispalyer-items',
  standalone: true,
  imports: [SkeletonModule, PaginatorModule, FormsModule],
  templateUrl: './designs-dispalyer-items.component.html',
  styleUrl: './designs-dispalyer-items.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignsDispalyerItemsComponent implements OnChanges {
  baseUrl = environment.baseUrl;

  @Input() selectedCategory: any = null;

  private categoriesService = inject(CategoriesService);
  private cdr = inject(ChangeDetectorRef);

  designsList: DesignModel[] = [];
  loading: boolean = true;
  page = 1;
  size = 10;
  count: number = 0;
  inputText: string = '';

  @Output() doClose = new EventEmitter<any>();
  @Output() doSelectDesign = new EventEmitter<any>();

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['selectedCategory'] &&
      changes['selectedCategory'].currentValue
    ) {
      this.getDesigns(changes['selectedCategory'].currentValue);
    }
  }

  inputChange() {
    if (this.inputText.length > 2 || this.inputText.length === 0) {
      this.getDesigns(this.selectedCategory, 1, 10, this.inputText);
    }
  }

  onPageChange(event: any) {
    this.loading = true;
    this.getDesigns(
      this.selectedCategory,
      event.page + 1,
      event.rows,
      this.inputText
    );
  }

  selectDesign(item: DesignModel) {
    fetch(item.url)
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const updatedItem = { ...item, url: blobUrl };
        this.doSelectDesign.emit(updatedItem);
      })
      .catch((error) => {
        console.error('Failed to convert image to Blob URL:', error);
        this.doSelectDesign.emit(item); // Fallback to original item
      });
  }
  getDesigns(id: string, page?: number, size?: number, search?: string) {
    this.categoriesService
      .getAllDesigns(id, page, size, search)
      .subscribe((data: any) => {
        this.count = data.count;
        this.designsList = data.items.map((design: any) => ({
          ...design,
          url: `${this.baseUrl}${design.url}`,
        }));

        this.loading = false;
        this.cdr.detectChanges();
      });
  }
}
