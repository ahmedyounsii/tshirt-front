import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SliderModule } from 'primeng/slider';
import { TextareaModule } from 'primeng/textarea';
import {
  designObject,
  TextAlign,
  TextStyleModel,
} from '../../../../models/design-object.model';
import { textColors, textFonts } from '../../../../shared/text-fonts';
import { ButtonModule } from 'primeng/button';
import { PanelHeaderComponent } from '../panel-header/panel-header.component';
import { SelectModule } from 'primeng/select';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-text-edition',
  standalone: true,
  imports: [TranslatePipe, ButtonModule, NgClass, PanelHeaderComponent, FormsModule, SelectModule, SliderModule, TextareaModule],
  templateUrl: './text-edition.component.html',
  styleUrl: './text-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextEditionComponent {
  // When set, the component edits this text object live instead of building a new one
  @Input() textObject: designObject | null = null;

  @Output() doClose = new EventEmitter<any>();
  @Output() doAddText = new EventEmitter<TextStyleModel>();

  fonts = textFonts;
  colors = textColors;
  aligns: TextAlign[] = ['left', 'center', 'right'];

  draft: TextStyleModel = this.defaultStyle();

  get isEditMode(): boolean {
    return !!this.textObject?.text;
  }

  get style(): TextStyleModel {
    return this.textObject?.text ?? this.draft;
  }

  defaultStyle(): TextStyleModel {
    return {
      content: '',
      fontFamily: textFonts[0],
      fontSize: 32,
      color: '#000000',
      bold: false,
      italic: false,
      underline: false,
      align: 'center',
      letterSpacing: 0,
    };
  }

  toggle(key: 'bold' | 'italic' | 'underline') {
    this.style[key] = !this.style[key];
  }

  addText() {
    if (!this.draft.content.trim()) return;
    this.doAddText.emit({ ...this.draft });
    // Keep the chosen style so the next text can be typed right away
    this.draft = { ...this.draft, content: '' };
  }
}
