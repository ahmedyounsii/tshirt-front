import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyComponent } from '../../components/empty/empty.component';
import { TagComponent } from '../../components/tag/tag.component';
import { CollectionsService } from '../../services/collections/collections.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { LanguageService } from '../../services/language.service';
import {
  CollectionModel,
  collectionLink,
  localized,
} from '../../models/collection.model';

// Admin: every collection, with links to edit them or create a new one
@Component({
  selector: 'app-manage-collections',
  standalone: true,
  imports: [TranslatePipe, RouterLink, ButtonModule, SkeletonModule, EmptyComponent, TagComponent],
  templateUrl: './manage-collections.component.html',
  styleUrl: './manage-collections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageCollectionsComponent implements OnInit {
  router = inject(Router);
  private collectionsService = inject(CollectionsService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  readonly collections = signal<CollectionModel[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  // Collection being deleted: its delete button shows a spinner meanwhile
  readonly deletingId = signal<string | null>(null);

  readonly link = collectionLink;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.collectionsService.getCollections().subscribe({
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

  title(collection: CollectionModel): string {
    return localized(collection.title, this.language.current());
  }

  // The products stay in the store: only the collection and its page go
  async remove(collection: CollectionModel): Promise<void> {
    if (this.deletingId()) return;
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('manageCollections.deleteMessage', { name: collection.name }),
      this.translate.instant('manageCollections.deleteHeader'),
    );
    if (!ok) return;

    this.deletingId.set(collection._id);
    this.collectionsService.deleteCollection(collection._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.collections.update((list) => list.filter((c) => c._id !== collection._id));
      },
      error: (err) => {
        console.error('Failed to delete the collection', err);
        this.deletingId.set(null);
        alert(this.translate.instant('manageCollections.deleteFailed'));
      },
    });
  }
}
