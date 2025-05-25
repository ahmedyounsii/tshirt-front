import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DesignsService } from '../../services/designs/design.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [SelectModule, FormsModule],
  templateUrl: './article.component.html',
  styleUrl: './article.component.scss',
})
export class ArticleComponent implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private designsService = inject(DesignsService);
  private categoriesService = inject(CategoriesService);
  private cdr = inject(ChangeDetectorRef);
  categoryLabel: string = '';
  designLabel: string = '';
  categories: any = [];
  selectedCategory: any = null;
  selected: any;

  ngOnInit(): void {
    this.activatedRoute.params.subscribe((params) => {
      this.selected = params['id'];
    });
    this.categoriesService.getAllCategories().subscribe((data) => {
      this.categories = data;
      this.cdr.detectChanges();
    });
  }

  addCategory() {
    this.categoriesService.addCategory(this.categoryLabel).subscribe((data) => {
      console.log(data);
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files[0]) {
      const maxSizeInBytes = 1 * 1024 * 1024; // 1MB

      const file = input.files[0];
      const formData = new FormData();

      if (file.size > maxSizeInBytes) {
        alert('File size exceeds 1MB limit');
        return;
      } else {
        formData.append('file', file);
        formData.append('label', this.designLabel); // Or use a user-defined label
        formData.append('categoryId', this.selectedCategory._id);
        this.designsService.addDesign(formData).subscribe((data) => {
          console.log(data);
        });
      }
    }
  }
}
