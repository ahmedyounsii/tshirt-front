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
import { DesignToAdd } from '../../../../models/design.model';
import { CategoriesService } from '../../../../services/categories/categories.service';
import {
  ALL_DESIGNS,
  DesignsDisplayerCategoriesComponent,
} from './components/designs-displayer-categories/designs-displayer-categories.component';
import { DesignsDispalyerItemsComponent } from './components/designs-dispalyer-items/designs-dispalyer-items.component';
import { TranslatePipe } from '@ngx-translate/core';
import { DesignsDisplayerState } from './designs-displayer.state';

// Graphics picker: category chips on top filter the designs grid below
@Component({
    selector: 'app-designs-displayer',
    imports: [
        TranslatePipe,
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
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DesignsDisplayerComponent implements OnDestroy {
  @Output() doSelectDesign = new EventEmitter<DesignToAdd>();
  @Output() doClose = new EventEmitter<any>();

  private state = inject(DesignsDisplayerState);
  private cdr = inject(ChangeDetectorRef);

  // Restored from the last opening
  selectedCategory: string = this.state.selectedCategory ?? ALL_DESIGNS;
  inputText = this.state.inputText;
  // Search sent to the designs list: only updated from 3 characters (or when cleared)
  search = this.state.search;
  private searchTimeout?: ReturnType<typeof setTimeout>;

  // Waits for a pause in the typing: one request per search, not per key
  inputChange() {
    this.state.inputText = this.inputText;
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (this.inputText.length > 2 || this.inputText.length === 0) {
        this.search = this.state.search = this.inputText;
        this.cdr.markForCheck();
      }
    }, 300);
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimeout);
  }

  selectDesign(design: DesignToAdd) {
    this.doSelectDesign.emit(design);
  }

  selectCategory(id: string) {
    this.selectedCategory = this.state.selectedCategory = id;
  }
}
