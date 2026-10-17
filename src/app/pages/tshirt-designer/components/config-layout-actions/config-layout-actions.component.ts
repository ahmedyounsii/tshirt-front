import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { designObject } from '../../../../models/design-object.model';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-config-layout-actions',
  standalone: true,
  imports: [ButtonModule, NgClass],
  templateUrl: './config-layout-actions.component.html',
  styleUrl: './config-layout-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigLayoutActionsComponent {
  @Input() selectedDesignFlipY: boolean = false;
  @Input() selectedDesignFlipX: boolean = false;

  @Output() doCenter = new EventEmitter<any>();
  @Output() doFlipX = new EventEmitter<any>();
  @Output() doFlipY = new EventEmitter<any>();
  @Output() doRemove = new EventEmitter<any>();
  @Output() doSelectedItem = new EventEmitter<any>();

  selectedItem: any = null;

  centerItem() {
    this.doCenter.emit();
  }
  flipItemX() {
    this.doFlipX.emit();
  }
  flipItemY() {
    this.doFlipY.emit();
  }

  selectItem(item: string) {
    if (this.selectedItem === item) {
      this.selectedItem = null;
    } else {
      this.selectedItem = item;
    }
    this.doSelectedItem.emit(item);
  }

  removeItem() {
    this.doRemove.emit();
  }
}
