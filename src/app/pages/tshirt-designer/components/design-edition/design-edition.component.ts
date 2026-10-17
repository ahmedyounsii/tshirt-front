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
import { TextEditionComponent } from '../text-edition/text-edition.component';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-design-edition',
  standalone: true,
  imports: [
    ButtonModule,
    FormsModule,
    SliderModule,
    ConfigLayoutActionsComponent,
    TextEditionComponent,
  ],
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

  get isText(): boolean {
    return this.selectedDesign.type === 'text';
  }

  centerItem() {
    const canvas = document.getElementById('canvas') as HTMLElement;
    const canvasRect = canvas.getBoundingClientRect();
    // Text objects are auto-sized, so measure the rendered element
    const element = document.getElementById(this.selectedDesign.id);
    const width =
      this.isText && element ? element.offsetWidth : this.selectedDesign.width;
    const centerX = (canvasRect.width - width) / 2;
    let padding = 0;
    Math.round(width) % 2 === 0 ? (padding = 2) : (padding = 3);
    this.selectedDesign.left = centerX - padding;
  }

  resetScale() {
    if (this.isText && this.selectedDesign.text) {
      this.selectedDesign.text.fontSize = 32;
      return;
    }
    this.selectedDesign.width = 100;
    this.selectedDesign.height = 100;
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
