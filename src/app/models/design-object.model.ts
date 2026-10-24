import { DesignModel } from './design.model';
import { TemplateModel } from './template.model';
import { DesignFilter } from '../shared/design-filters';

export type DesignSide = 'front' | 'back';

export type TextAlign = 'left' | 'center' | 'right';

export type TextStyleModel = {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  letterSpacing: number;
};

export type designObject = {
  id: string;
  type?: 'image' | 'text';
  // Side of the product the object is placed on (front when missing)
  side?: DesignSide;
  url: any;
  width: number;
  height: number;
  left: number;
  top: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  design?: DesignModel;
  text?: TextStyleModel;
  // Print effect of an image: url then shows the filtered image, design.url the original
  filter?: DesignFilter;
};

// A designObject as stored with a saved product, in back to front order.
// Images reference their design by id; its url and label are kept as a snapshot
// so the product can be shown (admin) without resolving the design
export type SavedDesignObject = Pick<
  designObject,
  | 'width'
  | 'height'
  | 'left'
  | 'top'
  | 'rotation'
  | 'flipX'
  | 'flipY'
  | 'text'
  | 'filter'
> & {
  type: 'image' | 'text';
  side: DesignSide;
  design?: string;
  designUrl?: string;
  designLabel?: string;
};
