import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyComponent } from '../empty/empty.component';
import { CollectionCardComponent } from '../../shared/collection-card/collection-card.component';
import { CollectionsService } from '../../services/collections/collections.service';
import { CollectionModel } from '../../models/collection.model';

// Collections tab of a profile: a card per collection, opening its landing page.
// "mine" for the logged in user's (drafts included, with the edit and delete buttons),
// else the published ones of "creator"
@Component({
  selector: 'app-profile-collections',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonModule,
    SkeletonModule,
    EmptyComponent,
    CollectionCardComponent,
  ],
  templateUrl: './profile-collections.component.html',
  styleUrl: './profile-collections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileCollectionsComponent implements OnInit {
  router = inject(Router);
  private collectionsService = inject(CollectionsService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @Input() mine = false;
  @Input() creator: string | null = null;

  readonly collections = signal<CollectionModel[]>([]);
  // Starts true so the server render shows the skeleton, not the empty state
  readonly loading = signal(true);
  readonly failed = signal(false);

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (this.isBrowser) this.load();
  }

  load(): void {
    const request = this.mine
      ? this.collectionsService.getCollections('mine')
      : this.creator
        ? this.collectionsService.getCreatorCollections(this.creator)
        : null;
    if (!request) return;
    this.loading.set(true);
    this.failed.set(false);
    request.subscribe({
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
