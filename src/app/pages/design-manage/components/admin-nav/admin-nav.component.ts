import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type AdminPanel = 'categories' | 'designs' | 'templates';

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './admin-nav.component.html',
  styleUrl: './admin-nav.component.scss',
})
export class AdminNavComponent {
  @Input() active: AdminPanel = 'categories';
  @Input() categoriesCount = 0;
  @Input() designsCount = 0;
  @Input() templatesCount = 0;
  @Output() activeChange = new EventEmitter<AdminPanel>();
}
