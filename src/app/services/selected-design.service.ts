import { Injectable, signal } from '@angular/core';
import { designObject } from '../models/design-object.model';

@Injectable({
  providedIn: 'root',
})
export class DesignsObjectService {
  designsObjectList = signal<designObject[]>([]);
  designObjectSignal = signal<designObject | null>(null);

  selectDesignObject(items: designObject[]) {
    this.designsObjectList.set(items);
  }
}
