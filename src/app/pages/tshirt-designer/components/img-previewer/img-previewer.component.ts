import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-img-previewer',
  standalone: true,
  imports: [],
  templateUrl: './img-previewer.component.html',
  styleUrl: './img-previewer.component.scss',
})
export class ImgPreviewerComponent {
  @Output() doClosePreviewer = new EventEmitter<any>();
  @Input() preview: any = null;
}
