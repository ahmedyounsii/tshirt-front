import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ArticleComponent } from './pages/article/article.component';
import { TshirtDesignerComponent } from './pages/tshirt-designer/tshirt-designer.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'article/:id', component: ArticleComponent },
  { path: 'article', component: ArticleComponent },
  { path: 'designer', component: TshirtDesignerComponent },
];
