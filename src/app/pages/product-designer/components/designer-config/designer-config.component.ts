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
import { DesignsDisplayerComponent } from '../designs-displayer/designs-displayer.component';
import { ProductEditionComponent } from '../product-edition/product-edition.component';
import { DesignModel, DesignToAdd } from '../../../../models/design.model';
import { UploadDesignComponent } from '../upload-logo/upload-design.component';
import { TextEditionComponent } from '../text-edition/text-edition.component';
import { TextStyleModel } from '../../../../models/design-object.model';
import { BottomDrawerComponent } from '../../../../components/bottom-drawer/bottom-drawer.component';

@Component({
    selector: 'app-designer-config',
    imports: [
        FormsModule,
        UploadDesignComponent,
        DesignsDisplayerComponent,
        ProductEditionComponent,
        TextEditionComponent,
        BottomDrawerComponent,
    ],
    templateUrl: './designer-config.component.html',
    styleUrl: './designer-config.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DesignerConfigComponent implements OnChanges {
  private cdr = inject(ChangeDetectorRef);

  titleLabel = "What's next for you?";

  @Input() selectedDesign: any;
  @Input() selectedConfigCategory: any;

  @Output() doAddDesign = new EventEmitter<DesignToAdd>();
  @Output() doAddText = new EventEmitter<TextStyleModel>();
  @Output() doUnselectDesignObject = new EventEmitter<any>();
  @Output() doSelectProduct = new EventEmitter<any>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDesign']) {
      this.cdr.detectChanges();
    }
  }

  doUpload(design: DesignModel) {
    this.doAddDesign.emit(design);
  }

  selectDesign(design: DesignToAdd) {
    this.doAddDesign.emit(design);
  }
}
