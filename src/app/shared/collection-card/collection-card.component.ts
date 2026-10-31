import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TagComponent } from '../../components/tag/tag.component';
import { AuthService } from '../../services/auth/auth.service';
import { CollectionsService } from '../../services/collections/collections.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { LanguageService } from '../../services/language.service';
import {
  canEditCollection,
  CollectionModel,
  collectionLink,
  localized,
} from '../../models/collection.model';
import { creatorDisplayName, creatorLink } from '../../models/user.model';
import { CollectionSaleComponent } from '../collection-sale/collection-sale.component';

// Card of a collection: its first products, name, products count, subtitle and page link.
// Its maker and the admins also get the edit and delete buttons, wherever it is shown
@Component({
    selector: 'app-collection-card',
    imports: [RouterLink, TranslatePipe, TagComponent, CollectionSaleComponent],
    templateUrl: './collection-card.component.html',
    styleUrl: './collection-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionCardComponent {
  private auth = inject(AuthService);
  private collectionsService = inject(CollectionsService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  readonly collection = input.required<CollectionModel>();
  // Where the cover leads; the collection's page when not set
  readonly link = input<string | unknown[] | null>(null);
  // Where the edit button leads; the user's own editor when not set
  readonly editLink = input<string | unknown[] | null>(null);
  // The admin page (/admin/collections): admins edit and delete every collection there only.
  // Everywhere else the buttons are the maker's
  readonly adminView = input(false);
  // The admin sees who made the collections of the users
  readonly showCreator = input(false);

  // Once deleted, for the list to drop it
  readonly deleted = output<CollectionModel>();

  readonly deleting = signal(false);

  readonly pageLink = computed(() => collectionLink(this.collection()));
  readonly coverLink = computed(() => this.link() ?? this.pageLink());
  readonly title = computed(() => localized(this.collection().title, this.language.current()));
  readonly creator = computed(() => this.collection().createdBy ?? null);
  readonly creatorLink = creatorLink;
  // Their open store's name, else their username
  readonly creatorName = creatorDisplayName;

  // On the admin page, the server's rule (admins every collection); elsewhere only the maker
  readonly canEdit = computed(() => {
    const collection = this.collection();
    const user = this.auth.user();
    if (this.adminView()) return canEditCollection(collection, user);
    return !!user && !!collection.createdBy && collection.createdBy._id === user._id;
  });
  readonly editorLink = computed(
    () => this.editLink() ?? ['/my-collections', this.collection()._id],
  );

  // The products stay in the store: only the collection and its page go
  async remove(): Promise<void> {
    if (this.deleting()) return;
    const collection = this.collection();
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('manageCollections.deleteMessage', { name: collection.name }),
      this.translate.instant('manageCollections.deleteHeader'),
    );
    if (!ok) return;

    this.deleting.set(true);
    this.collectionsService.deleteCollection(collection._id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleted.emit(collection);
      },
      error: (err) => {
        console.error('Failed to delete the collection', err);
        this.deleting.set(false);
        alert(this.translate.instant('manageCollections.deleteFailed'));
      },
    });
  }
}
