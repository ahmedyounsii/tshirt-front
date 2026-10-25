import { DesignModel } from './design.model';
import { TemplateModel } from './template.model';
import { DesignFilter, DesignFilterType } from '../shared/design-filters';

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
  // Letters thinned (< 0) or thickened (> 0), in % of the font size (see TEXT_THICKNESS_LIMITS)
  thickness?: number;
  // Outline width around the letters (px); no outline when 0 or missing
  strokeWidth?: number;
  strokeColor?: string;
  // Bend along an arc, -100 to 100 (full circle); straight when 0 or missing
  curve?: number;
  // Width and height of the letters in % (see TEXT_STRETCH_LIMITS); 100 when missing
  stretchX?: number;
  stretchY?: number;
  // Shadow behind the text (see TEXT_SHADOW_*_LIMITS); none while its distance and blur are 0
  shadowDistance?: number;
  shadowAngle?: number;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowColor?: string;
  // Print effect, as on images; none when missing
  filter?: DesignFilterType;
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
