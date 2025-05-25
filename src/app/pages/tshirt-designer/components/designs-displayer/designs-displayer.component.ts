import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { DesignModel } from '../../../../models/design.model';
import { DesignCategoryModel } from '../../../../models/design-catergory.model';
import { CategoriesService } from '../../../../services/categories/categories.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { delay } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DesignsDisplayerCategoriesComponent } from './components/designs-displayer-categories/designs-displayer-categories.component';
import { DesignsDispalyerItemsComponent } from './components/designs-dispalyer-items/designs-dispalyer-items.component';

@Component({
  selector: 'app-designs-displayer',
  standalone: true,
  imports: [
    InputTextModule,
    FormsModule,
    DesignsDisplayerCategoriesComponent,
    DesignsDispalyerItemsComponent,
  ],
  providers: [CategoriesService, HttpClient],
  templateUrl: './designs-displayer.component.html',
  styleUrl: './designs-displayer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignsDisplayerComponent implements OnInit {
  @Input() designsList: DesignModel[] = [];
  @Output() doSelectDesign = new EventEmitter<any>();
  @Output() doSelectDesignCategory = new EventEmitter<any>();
  @Output() doClose = new EventEmitter<any>();

  selectedCategory: any = null;

  ngOnInit(): void {}

  selectDesign(design: DesignModel) {
    this.doSelectDesign.emit(design);
  }

  selectDesignCategory(category: DesignCategoryModel) {
    this.doSelectDesignCategory.emit(category);
  }

  returnToCategory() {
    this.selectedCategory = null;
    this.designsList = [];
  }

  selectCategory(id: string) {
    this.selectedCategory = id;
  }
}
