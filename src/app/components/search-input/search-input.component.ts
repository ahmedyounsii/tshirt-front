import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

// Wait for a pause in the typing before searching, instead of one request per key
const DEBOUNCE_MS = 300;

@Component({
    selector: 'app-search-input',
    imports: [FormsModule],
    templateUrl: './search-input.component.html',
    styleUrl: './search-input.component.scss'
})
export class SearchInputComponent implements OnDestroy {
  @Input() value = '';
  @Input() placeholder = 'Search...';
  @Output() valueChange = new EventEmitter<string>();

  private timeout?: ReturnType<typeof setTimeout>;

  onInput(value: string) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.valueChange.emit(value), DEBOUNCE_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeout);
  }
}
