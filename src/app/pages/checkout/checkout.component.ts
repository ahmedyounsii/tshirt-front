import {
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CartService } from '../../services/cart/cart.service';
import { AuthService } from '../../services/auth/auth.service';
import { OrdersService } from '../../services/orders/orders.service';
import { LanguageService } from '../../services/language.service';
import { cartItemKey } from '../../models/cart.model';
import {
  DeliveryMethod,
  OrderModel,
  ShippingAddress,
} from '../../models/order.model';
import {
  arrivalRange,
  DELIVERY_OPTIONS,
  DeliveryOption,
  deliveryOptionOf,
  FREE_SHIPPING_FROM,
  shippingCost,
} from '../../shared/checkout.config';
import { CartLineComponent } from '../../components/cart-line/cart-line.component';
import { environment } from '../../../environments/environment';

type StepId = 'bag' | 'shipping' | 'delivery' | 'review';

const STEPS: { id: StepId; icon: string }[] = [
  { id: 'bag', icon: 'pi pi-shopping-bag' },
  { id: 'shipping', icon: 'pi pi-map-marker' },
  { id: 'delivery', icon: 'pi pi-truck' },
  { id: 'review', icon: 'pi pi-check-square' },
];

// The last shipping address, to prefill the next checkout (per browser convenience)
const ADDRESS_KEY = 'checkout-address';
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,}$/;

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CurrencyPipe,
    TranslatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SkeletonModule,
    CartLineComponent,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit {
  cart = inject(CartService);
  private auth = inject(AuthService);
  private orders = inject(OrdersService);
  private language = inject(LanguageService);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly steps = STEPS;
  readonly deliveryOptions = DELIVERY_OPTIONS;
  readonly freeShippingFrom = FREE_SHIPPING_FROM;
  readonly key = cartItemKey;
  readonly baseUrl = environment.baseUrl;

  step = signal(0);
  // Furthest step reached: the ones up to it can be jumped back to from the stepper
  furthest = signal(0);
  // Mobile only: the order summary is folded above the steps
  summaryOpen = signal(false);

  delivery = signal<DeliveryMethod>('standard');
  placing = signal(false);
  error = signal<string | null>(null);
  // Set once placed: the page turns into the confirmation
  order = signal<OrderModel | null>(null);

  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    address: ['', Validators.required],
    city: ['', Validators.required],
    postalCode: ['', Validators.required],
    country: ['', Validators.required],
    notes: ['', Validators.maxLength(300)],
  });

  deliveryOption = computed(() => deliveryOptionOf(this.delivery()));
  shipping = computed(() => shippingCost(this.deliveryOption(), this.cart.subtotal()));
  total = computed(() => Math.round((this.cart.subtotal() + this.shipping()) * 100) / 100);

  ngOnInit(): void {
    const saved = this.readAddress();
    const user = this.auth.user();
    this.form.patchValue({
      fullName: user?.name ?? '',
      email: user?.email ?? '',
      ...saved,
      notes: '',
    });
    // Current prices before reviewing
    this.cart.reload();
  }

  get current(): StepId {
    return STEPS[this.step()].id;
  }

  // Shipping cost of an option for the current cart
  costOf(option: DeliveryOption): number {
    return shippingCost(option, this.cart.subtotal());
  }

  // e.g. "Tue, Oct 21 – Thu, Oct 23", from the order date
  arrival(option: DeliveryOption, from = new Date()): string {
    return arrivalRange(option, from, this.language.current());
  }

  orderArrival(order: OrderModel): string {
    return this.arrival(deliveryOptionOf(order.delivery), new Date(order.createdAt));
  }

  // Shows a field's error once the user has interacted with it
  invalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  canOpen(index: number): boolean {
    if (index > this.furthest() || this.placing()) return false;
    return index <= 1 || this.form.valid;
  }

  goTo(index: number) {
    if (index === this.step() || !this.canOpen(index)) return;
    this.step.set(index);
    this.error.set(null);
    this.scrollTop();
  }

  next() {
    if (this.current === 'shipping' && this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    const next = Math.min(STEPS.length - 1, this.step() + 1);
    this.step.set(next);
    this.furthest.update((f) => Math.max(f, next));
    this.scrollTop();
  }

  back() {
    this.goTo(this.step() - 1);
  }

  placeOrder() {
    if (this.placing() || this.form.invalid || !this.cart.items().length) return;
    this.placing.set(true);
    this.error.set(null);
    const shipping = this.form.getRawValue() as ShippingAddress;
    this.orders
      .placeOrder({ shipping, delivery: this.delivery(), payment: 'cod' })
      .subscribe({
        next: (order) => {
          this.placing.set(false);
          this.order.set({
            ...order,
            items: order.items.map((i) => ({ ...i, url: `${this.baseUrl}${i.url}` })),
          });
          this.cart.clearLocal();
          this.saveAddress(shipping);
          this.scrollTop();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to place the order', err);
          this.placing.set(false);
          this.error.set(
            err.status === 400 && err.error?.message
              ? err.error.message
              : this.translate.instant('checkout.review.failed'),
          );
          // The cart may have changed on the server (product removed or repriced)
          this.cart.reload();
        },
      });
  }

  private focusFirstInvalid() {
    queueMicrotask(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.co-form .ng-invalid[formControlName]')
        ?.focus(),
    );
  }

  private scrollTop() {
    if (this.isBrowser) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private readAddress(): Partial<ShippingAddress> {
    if (!this.isBrowser) return {};
    try {
      return JSON.parse(localStorage.getItem(ADDRESS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  private saveAddress({ notes, ...address }: ShippingAddress) {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
    } catch {}
  }
}
