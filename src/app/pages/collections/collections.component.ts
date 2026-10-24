import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { FooterComponent } from '../../components/footer/footer.component';
import { TagComponent } from '../../components/tag/tag.component';
import { EmptyComponent } from '../../components/empty/empty.component';
import { CollectionShowcaseComponent } from '../../shared/collection-showcase/collection-showcase.component';
import { CollectionsService } from '../../services/collections/collections.service';
import { CollectionModel } from '../../models/collection.model';

// Every collection, one showcase each, linking to its own landing page (/collection/<slug>)
@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [
    CollectionShowcaseComponent,
    TagComponent,
    TranslatePipe,
    RouterLink,
    FooterComponent,
    SkeletonModule,
    EmptyComponent,
  ],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsComponent implements OnInit {
  router = inject(Router);
  private collectionsService = inject(CollectionsService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly collections = signal<CollectionModel[]>([]);
  // Starts true so the server render shows the skeleton, not the empty state
  readonly loading = signal(true);

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.collectionsService.getCollections().subscribe({
      next: (collections) => {
        this.collections.set(collections);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load collections', err);
        this.loading.set(false);
      },
    });
  }
}
