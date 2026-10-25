import {
  Directive,
  DoCheck,
  ElementRef,
  inject,
  Input,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TextStyleModel } from '../models/design-object.model';
import {
  forgetTextCanvas,
  loadTextFont,
  paintTextCanvas,
  textFont,
} from './text-render';

// Device pixels per editor pixel of the designer texts: sharp on retina screens and in captures
export const editorTextRatio = (): number =>
  Math.max(2, globalThis.devicePixelRatio || 1);

// Draws a text object on its canvas, again whenever its style changes (texts are edited in place)
@Directive({
  selector: 'canvas[appTextCanvas]',
  standalone: true,
})
export class TextCanvasDirective implements DoCheck {
  private canvas: HTMLCanvasElement = inject(ElementRef).nativeElement;
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @Input({ required: true }) appTextCanvas!: TextStyleModel;
  // Device pixels per editor pixel
  @Input() textCanvasRatio = editorTextRatio();
  // The canvas takes the text size in editor px; off where CSS sizes it
  @Input() textCanvasSized = true;

  // Font (and characters) last loaded
  private fontKey = '';

  ngDoCheck(): void {
    if (!this.isBrowser || !this.appTextCanvas) return;
    this.paint();
    this.loadFont();
  }

  private paint() {
    paintTextCanvas(
      this.canvas,
      this.appTextCanvas,
      this.textCanvasRatio,
      this.textCanvasSized,
    );
  }

  // Until its font is loaded the text shows in a fallback font: paint again once it is
  private loadFont() {
    const text = this.appTextCanvas;
    const key = `${textFont(text)}|${text.content}`;
    if (key === this.fontKey) return;
    this.fontKey = key;
    loadTextFont(text).then(() => {
      if (key !== this.fontKey) return;
      forgetTextCanvas(this.canvas);
      this.paint();
    });
  }
}
