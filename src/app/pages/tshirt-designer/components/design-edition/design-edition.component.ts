import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SliderModule } from 'primeng/slider';
import { ConfigLayoutActionsComponent } from '../config-layout-actions/config-layout-actions.component';
import { designObject } from '../../../../models/design-object.model';

@Component({
  selector: 'app-design-edition',
  standalone: true,
  imports: [FormsModule, SliderModule, ConfigLayoutActionsComponent],
  templateUrl: './design-edition.component.html',
  styleUrl: './design-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignEditionComponent implements OnChanges {
  @Input() selectedDesign!: designObject;
  @Input() selectedDesignLeft: any;
  @Input() selectedDesignTop: any;
  @Input() selectedDesignWidth: any;
  @Output() doRemove = new EventEmitter<any>();

  scale = 0;
  translateX = 0;
  translateY = 0;

  selectedConfigItem: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    this.translateX = this.selectedDesignLeft;
    this.translateY = this.selectedDesignTop;
    this.scale = this.selectedDesign.width;
  }

  onScale() {
    this.selectedDesign.width = this.scale;
    this.selectedDesign.height = this.scale;
  }

  resetRotation() {
    this.selectedDesign.rotation = 0;
  }

  flipItemX() {
    this.selectedDesign.flipX = !this.selectedDesign.flipX;
  }
  flipItemY() {
    this.selectedDesign.flipY = !this.selectedDesign.flipY;
  }

  centerItem() {
    const canvas = document.getElementById('canvas') as HTMLElement;
    const canvasRect = canvas.getBoundingClientRect();
    const centerX = (canvasRect.width - this.selectedDesign.width) / 2;
    let padding = 0;
    this.selectedDesign.width % 2 === 0 ? (padding = 2) : (padding = 3);
    this.selectedDesign.left = centerX - padding;
  }

  onTranslate() {
    this.selectedDesign.left = this.translateX;
    this.selectedDesign.top = this.translateY;
  }

  removeItem() {
    this.doRemove.emit();
  }

  selectedItem(item: string) {
    if (this.selectedConfigItem === item) {
      this.selectedConfigItem = null;
      return;
    }
    this.selectedConfigItem = item;
  }
}
