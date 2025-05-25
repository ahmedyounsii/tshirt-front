import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SliderModule } from 'primeng/slider';
import { InputTextModule } from 'primeng/inputtext';
import { DesignsDisplayerComponent } from '../designs-displayer/designs-displayer.component';
import { ProductEditionComponent } from '../product-edition/product-edition.component';
import { DesignModel } from '../../../../models/design.model';
import { UploadDesignComponent } from '../upload-logo/upload-design.component';
import { TextEditionComponent } from '../text-edition/text-edition.component';

@Component({
  selector: 'app-designer-config',
  standalone: true,
  imports: [
    SliderModule,
    FormsModule,
    InputTextModule,
    UploadDesignComponent,
    DesignsDisplayerComponent,
    ProductEditionComponent,
    TextEditionComponent,
  ],
  templateUrl: './designer-config.component.html',
  styleUrl: './designer-config.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignerConfigComponent implements OnChanges {
  private cdr = inject(ChangeDetectorRef);

  titleLabel = "What's next for you?";

  @Input() selectedDesign: any;
  @Input() selectedConfigCategory: any;

  @Output() doAddDesign = new EventEmitter<any>();
  @Output() doUnselectDesignObject = new EventEmitter<any>();
  @Output() doSelectProduct = new EventEmitter<any>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDesign']) {
      this.cdr.detectChanges();
    }
  }

  closeButton() {
    this.doUnselectDesignObject.emit();
  }

  doUpload(url: string) {
    const newDesign: DesignModel = {
      url: url,
    };
    this.doAddDesign.emit(newDesign);
  }

  selectDesign(design: DesignModel) {
    this.doAddDesign.emit(design);
  }
}
