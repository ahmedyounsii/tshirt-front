import { DesignModel } from './design.model';
import { TemplateModel } from './template.model';

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
  // Side of the tshirt the object is placed on (front when missing)
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
};

// A designObject as stored with a saved tshirt, in back to front order.
// Images reference their design by id; its url and label are kept as a snapshot
// so the tshirt can be shown (admin) without resolving the design
export type SavedDesignObject = Pick<
  designObject,
  'width' | 'height' | 'left' | 'top' | 'rotation' | 'flipX' | 'flipY' | 'text'
> & {
  type: 'image' | 'text';
  side: DesignSide;
  design?: string;
  designUrl?: string;
  designLabel?: string;
};
