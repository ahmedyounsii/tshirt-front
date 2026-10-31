import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CartItem,
  cartItemKey,
  CartResponse,
  CartProduct,
  CustomDesignDraft,
  MAX_QUANTITY,
  SizeQuantity,
} from '../../models/cart.model';
import { ProductModel } from '../../models/product.model';
import { AuthService } from '../auth/auth.service';
import { DiscountsService } from '../discounts/discounts.service';

const GUEST_CART_KEY = 'guest-cart';
// How long freshly added lines stay highlighted in the drawer
const HIGHLIGHT_MS = 2500;

const clampQuantity = (quantity: number) =>
  Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity) || 1));

// The shopping cart, shared by the "Shop now" dialog, the header drawer and the checkout.
// Logged in users' cart is stored on the server (api/cart). Guests get one in localStorage,
// merged into their server cart as soon as they log in (checkout requires an account)
@Injectable({
  providedIn: 'root',
})
export class CartService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private discounts = inject(DiscountsService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private apiUrl = 'api/cart';
  private baseUrl = environment.baseUrl;
  private highlightTimer?: ReturnType<typeof setTimeout>;
  // Only the response of the latest request is applied: quick +/- clicks can't reorder the cart
  private requestSeq = 0;
  // A guest cart is being merged: its response is the fresh cart, a reload could beat it
  private merging = false;

  readonly items = signal<CartItem[]>([]);
  // The server cart is being fetched
  readonly loading = signal(false);
  readonly drawerOpen = signal(false);
  // Product whose "Shop now" dialog is open
  readonly picking = signal<ProductModel | null>(null);
  // The designer's "Buy" design shown by the picker: only sent once its sizes are added
  private draft: CustomDesignDraft | null = null;
  // Lines just added, highlighted when the drawer opens
  readonly highlighted = signal<Set<string>>(new Set());

  // Number of products, not of lines
  readonly count = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0),
  );
  // Discounts included, as the server charges it
  readonly subtotal = computed(
    () =>
      Math.round(
        this.items().reduce(
          (sum, item) => sum + this.discounts.unitPrice(item.product) * item.quantity,
          0,
        ) * 100,
      ) / 100,
  );
  // Taken off by the discounts
  readonly savings = computed(() => {
    const full = this.items().reduce(
      (sum, item) => sum + (item.product.price ?? 0) * item.quantity,
      0,
    );
    return Math.max(0, Math.round((full - this.subtotal()) * 100) / 100);
  });

  constructor() {
    if (!this.isBrowser) return;
    // Logging in merges the guest cart into the user's; logging out shows the (empty) guest cart
    effect(
      () => {
        const loggedIn = this.auth.isLoggedIn();
        untracked(() =>
          loggedIn ? this.syncWithServer() : this.items.set(this.readGuest()),
        );
      },
      { allowSignalWrites: true },
    );
  }

  openPicker(product: ProductModel) {
    this.draft = null;
    this.picking.set(product);
  }

  // The designer's "Buy": picks the sizes of a design that isn't saved as a product
  openDraftPicker(draft: CustomDesignDraft) {
    this.draft = draft;
    this.picking.set(draft.product);
  }

  closePicker() {
    this.picking.set(null);
  }

  // How many of this product in this size are already in the cart
  quantityOf(productId: string | undefined, size: string): number {
    if (!productId) return 0;
    const key = cartItemKey({ product: productId, size });
    return this.items().find((item) => cartItemKey(item) === key)?.quantity ?? 0;
  }

  // Adds the picked sizes on top of what's already in the cart, then opens the drawer on them
  async add(product: ProductModel, picks: SizeQuantity[]): Promise<void> {
    const id = product._id;
    const lines = picks.filter((p) => p.quantity > 0);
    if (!id || !lines.length) return;

    // A design from the designer: sent with its sizes, the server answers its lines
    if (this.draft?.product._id === id) {
      const formData = this.draft.formData;
      formData.set(
        'items',
        JSON.stringify(lines.map((l) => ({ size: l.size, quantity: l.quantity }))),
      );
      const seq = ++this.requestSeq;
      const before = new Set(this.items().map(cartItemKey));
      const cart = await firstValueFrom(
        this.http.post<CartResponse>(`${this.apiUrl}/custom`, formData),
      );
      this.draft = null;
      if (seq === this.requestSeq) this.apply(cart);
      this.highlight(this.items().map(cartItemKey).filter((key) => !before.has(key)));
      this.drawerOpen.set(true);
      return;
    }

    if (this.auth.isLoggedIn()) {
      const seq = ++this.requestSeq;
      const cart = await firstValueFrom(
        this.http.post<CartResponse>(`${this.apiUrl}/items`, {
          items: lines.map((l) => ({ product: id, size: l.size, quantity: l.quantity })),
        }),
      );
      if (seq === this.requestSeq) this.apply(cart);
    } else {
      const snapshot = this.snapshotOf(product);
      const items = [...this.items()];
      for (const line of lines) {
        const key = cartItemKey({ product: id, size: line.size });
        const index = items.findIndex((item) => cartItemKey(item) === key);
        if (index >= 0) {
          const quantity = Math.min(MAX_QUANTITY, items[index].quantity + line.quantity);
          items[index] = { ...items[index], quantity };
        } else {
          items.push({
            product: snapshot,
            size: line.size,
            quantity: clampQuantity(line.quantity),
            addedAt: new Date().toISOString(),
          });
        }
      }
      this.setGuest(items);
    }

    this.highlight(lines.map((l) => cartItemKey({ product: id, size: l.size })));
    this.drawerOpen.set(true);
  }

  // Updated right away, the server's answer then replaces it
  setQuantity(item: CartItem, quantity: number) {
    const next = clampQuantity(quantity);
    if (next === item.quantity) return;
    const key = cartItemKey(item);
    const items = this.items().map((i) =>
      cartItemKey(i) === key ? { ...i, quantity: next } : i,
    );
    if (!this.auth.isLoggedIn()) return this.setGuest(items);
    this.items.set(items);
    this.send(
      this.http.patch<CartResponse>(`${this.apiUrl}/items`, {
        product: item.product._id,
        size: item.size,
        quantity: next,
      }),
    );
  }

  remove(item: CartItem) {
    const key = cartItemKey(item);
    const items = this.items().filter((i) => cartItemKey(i) !== key);
    if (!this.auth.isLoggedIn()) return this.setGuest(items);
    this.items.set(items);
    this.send(
      this.http.delete<CartResponse>(
        `${this.apiUrl}/items/${item.product._id}/${item.size}`,
      ),
    );
  }

  // After an order: the server already emptied the cart
  clearLocal() {
    this.requestSeq++;
    this.items.set([]);
  }

  reload() {
    if (!this.auth.isLoggedIn() || this.merging) return;
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.http.get<CartResponse>(this.apiUrl).subscribe({
      next: (cart) => {
        if (seq === this.requestSeq) this.apply(cart);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load the cart', err);
        this.loading.set(false);
      },
    });
  }

  // Sends the guest cart (if any) to the server, then shows the merged cart
  private syncWithServer() {
    const guest = this.readGuest();
    if (!guest.length) return this.reload();

    const seq = ++this.requestSeq;
    this.merging = true;
    this.loading.set(true);
    this.http
      .post<CartResponse>(`${this.apiUrl}/items`, {
        items: guest.map((i) => ({
          product: i.product._id,
          size: i.size,
          quantity: i.quantity,
        })),
      })
      .subscribe({
        next: (cart) => {
          this.merging = false;
          this.writeGuest([]);
          if (seq === this.requestSeq) this.apply(cart);
          this.loading.set(false);
        },
        // Nothing left for sale in it: drop it and show the server cart
        error: (err) => {
          console.error('Failed to merge the guest cart', err);
          this.merging = false;
          this.writeGuest([]);
          this.reload();
        },
      });
  }

  private send(request: Observable<CartResponse>) {
    const seq = ++this.requestSeq;
    request.subscribe({
      next: (cart) => {
        if (seq === this.requestSeq) this.apply(cart);
      },
      error: (err) => {
        console.error('Failed to update the cart', err);
        if (seq === this.requestSeq) this.reload();
      },
    });
  }

  private apply(cart: CartResponse) {
    this.items.set(
      (cart.items || []).map((item) => ({
        ...item,
        product: {
          ...item.product,
          url: this.absolute(item.product.url)!,
          backUrl: this.absolute(item.product.backUrl),
        },
      })),
    );
  }

  // Server urls are relative to the API; gallery products already have absolute ones
  private absolute(url?: string): string | undefined {
    if (!url || /^(https?:|data:|blob:)/.test(url)) return url;
    return `${this.baseUrl}${url}`;
  }

  private snapshotOf(product: ProductModel): CartProduct {
    return {
      _id: product._id!,
      label: product.label,
      url: this.absolute(product.url)!,
      backUrl: this.absolute(product.backUrl),
      price: product.price,
      category: product.category,
      templateId: product.templateId,
      template: product.template,
      canvas: product.canvas,
      printAreas: product.printAreas,
      objects: product.objects,
    };
  }

  private highlight(keys: string[]) {
    clearTimeout(this.highlightTimer);
    this.highlighted.set(new Set(keys));
    this.highlightTimer = setTimeout(
      () => this.highlighted.set(new Set()),
      HIGHLIGHT_MS,
    );
  }

  private setGuest(items: CartItem[]) {
    this.items.set(items);
    this.writeGuest(items);
  }

  private readGuest(): CartItem[] {
    if (!this.isBrowser) return [];
    try {
      const items = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
      return Array.isArray(items)
        ? items
            // Carts saved before the rename hold the line's product under "tshirt"
            .map((i) => {
              if (!i?.tshirt) return i;
              const { tshirt, ...item } = i;
              return { ...item, product: tshirt };
            })
            .filter((i) => i?.product?._id && i.size && i.quantity > 0)
        : [];
    } catch {
      return [];
    }
  }

  private writeGuest(items: CartItem[]) {
    if (!this.isBrowser) return;
    try {
      if (items.length) localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
      else localStorage.removeItem(GUEST_CART_KEY);
    } catch {}
  }
}
