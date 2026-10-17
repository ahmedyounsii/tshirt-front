import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ShopNowDialogComponent } from './components/shop-now-dialog/shop-now-dialog.component';
import { ImgPreviewerComponent } from './components/img-previewer/img-previewer.component';
import { PreviewService } from './services/preview/preview.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    ConfirmDialogComponent,
    ShopNowDialogComponent,
    ImgPreviewerComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  previewer = inject(PreviewService);
}
