import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import _ from 'lodash';
import { NgClass } from '@angular/common';
import {
  downloadImageLogic,
  dragReize,
  getImageBlob,
} from './logic/designer-logic';
import { FormsModule } from '@angular/forms';
import { ConfigCategoriesComponent } from './components/config-categories/config-categories.component';
import { DesignEditionComponent } from './components/design-edition/design-edition.component';
import { designObject } from '../../models/design-object.model';
import { SelectedProductService } from '../../services/selected-product.service';
import { TemplateModel } from '../../models/template.model';
import { DesignerConfigComponent } from './components/designer-config/designer-config.component';
import { DesignsObjectService } from '../../services/selected-design.service';
import { ImgPreviewerComponent } from './components/img-previewer/img-previewer.component';
import { toJpeg, toPng } from 'html-to-image';

@Component({
  selector: 'app-tshirt-designer',
  standalone: true,
  imports: [
    DesignerConfigComponent,
    NgClass,
    FormsModule,
    ConfigCategoriesComponent,
    DesignEditionComponent,
    ImgPreviewerComponent,
  ],
  templateUrl: './tshirt-designer.component.html',
  styleUrl: './tshirt-designer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TshirtDesignerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef;
  @ViewChild('configRef') configRef!: ElementRef;

  private cdr = inject(ChangeDetectorRef);

  private selectedProductService = inject(SelectedProductService);
  private designsObjectService = inject(DesignsObjectService);

  selectedConfigCategory: any = null;
  selectedDesign: any = null;
  selectedProduct: TemplateModel | null = null;
  desableUnselect = false;
  preview: any = null;
  designsObject: designObject[] = [];

  constructor() {
    effect(() => {
      this.selectedProduct = this.selectedProductService.product();
      this.designsObject = this.designsObjectService.designsObjectList();
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    if (!this.selectedDesign) return;
    dragReize(this.selectedDesign);
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.canvasRef && this.configRef) {
      const clickedInside =
        this.canvasRef?.nativeElement.contains(event.target) ||
        this.configRef?.nativeElement.contains(event.target);

      if (!clickedInside && this.selectedDesign) {
        this.unSelectDesignObject();
      }
      this.desableUnselect = false;
    }
  }

  selectConfigCategory(item: any) {
    this.selectedConfigCategory = item;
  }

  selectDesignObject(designObject: designObject) {
    this.desableUnselect = true;
    this.selectedDesign = designObject;
    this.ngAfterViewInit();
    this.cdr.detectChanges();
  }

  addDesign(designObject: designObject) {
    console.log(designObject);

    const newDesignObject = {
      id: `design_${_.random(0, 9999)}`,
      url: designObject.url,
      width: 100,
      height: 100,
      left: 0,
      top: 0,
      rotation: 0,
      flipX: false,
      flipY: false,
      design: designObject,
    };
    this.designsObject.push(newDesignObject);
    this.selectDesignObject(newDesignObject);
  }

  deleteDesignObject(designObject: designObject, event?: any) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.designsObject = this.designsObject.filter(
      (item) => item.id !== designObject.id
    );
    this.unSelectDesignObject();
  }

  unSelectDesignObject() {
    this.selectedDesign = null;
    this.selectedConfigCategory = null;
    this.designsObjectService.selectDesignObject(this.designsObject);
    this.cdr.detectChanges();
    this.ngAfterViewInit();
  }

  async export() {
    // const blob = await getImageBlob('.designer-container');
    // if (blob) {
    //   const url = URL.createObjectURL(blob);
    //   this.preview = url;
    // }
    // this.cdr.detectChanges();
    // downloadImageLogic('.designer-container');
    const element = document.querySelector(
      '.designer-container'
    ) as HTMLElement;

    if (element) {
      toPng(element)
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = 'my-image.png'; // File name
          link.href = dataUrl;
          link.click(); // Trigger the download
        })
        .catch((err) => {
          console.error('Error generating image:', err);
        });
    }
  }

  ngOnDestroy(): void {
    this.designsObjectService.selectDesignObject(this.designsObject);
  }
}
