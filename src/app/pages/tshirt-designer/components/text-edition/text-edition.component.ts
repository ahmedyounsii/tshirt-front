import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-text-edition',
  standalone: true,
  imports: [],
  templateUrl: './text-edition.component.html',
  styleUrl: './text-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextEditionComponent {
  @Output() doClose = new EventEmitter<any>();
}
