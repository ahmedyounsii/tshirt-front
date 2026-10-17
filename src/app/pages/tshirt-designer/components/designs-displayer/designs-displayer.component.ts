import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  OnDestroy,
  Output,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PanelHeaderComponent } from '../panel-header/panel-header.component';
import { DesignModel } from '../../../../models/design.model';
import { CategoriesService } from '../../../../services/categories/categories.service';
import {
  ALL_DESIGNS,
  DesignsDisplayerCategoriesComponent,
} from './components/designs-displayer-categories/designs-displayer-categories.component';
import { DesignsDispalyerItemsComponent } from './components/designs-dispalyer-items/designs-dispalyer-items.component';

// Graphics picker: category chips on top filter the designs grid below
@Component({
  selector: 'app-designs-displayer',
  standalone: true,
  imports: [
    FormsModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    DesignsDisplayerCategoriesComponent,
    DesignsDispalyerItemsComponent,
    PanelHeaderComponent,
  ],
  providers: [CategoriesService, HttpClient],
  templateUrl: './designs-displayer.component.html',
  styleUrl: './designs-displayer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignsDisplayerComponent implements OnDestroy {
  @Output() doSelectDesign = new EventEmitter<any>();
  @Output() doClose = new EventEmitter<any>();

  selectedCategory: string = ALL_DESIGNS;
  inputText = '';
  // Search sent to the designs list: only updated from 3 characters (or when cleared)
  search = '';

  private cdr = inject(ChangeDetectorRef);
  private searchTimeout?: ReturnType<typeof setTimeout>;

  // Waits for a pause in the typing: one request per search, not per key
  inputChange() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (this.inputText.length > 2 || this.inputText.length === 0) {
        this.search = this.inputText;
        this.cdr.markForCheck();
      }
    }, 300);
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimeout);
  }

  selectDesign(design: DesignModel) {
    this.doSelectDesign.emit(design);
  }

  selectCategory(id: string) {
    this.selectedCategory = id;
  }
}
