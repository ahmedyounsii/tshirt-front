import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyComponent } from '../../components/empty/empty.component';
import { CollectionCardComponent } from '../../shared/collection-card/collection-card.component';
import { CollectionsService } from '../../services/collections/collections.service';
import { CollectionModel } from '../../models/collection.model';

// Admin: every collection, with links to edit them or create a new one.
// Users get the same page for their own collections (/my-collections)
@Component({
  selector: 'app-manage-collections',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonModule,
    SkeletonModule,
    EmptyComponent,
    CollectionCardComponent,
  ],
  templateUrl: './manage-collections.component.html',
  styleUrl: './manage-collections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageCollectionsComponent implements OnInit {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private collectionsService = inject(CollectionsService);

  readonly collections = signal<CollectionModel[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  // Only the logged in user's collections, under /my-collections
  readonly mine = !!this.route.snapshot.data['mine'];
  // The seller dashboard mounts the same pages under its own URL (route data.base)
  readonly base: string =
    this.route.snapshot.data['base'] ?? (this.mine ? '/my-collections' : '/admin/collections');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.collectionsService.getCollections(this.mine ? 'mine' : 'all').subscribe({
      next: (collections) => {
        this.collections.set(collections);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load collections', err);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  removed(collection: CollectionModel): void {
    this.collections.update((list) => list.filter((c) => c._id !== collection._id));
  }
}
