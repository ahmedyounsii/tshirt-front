import { DesignSide, SavedDesignObject } from './design-object.model';
import { TemplateModel } from './template.model';
import { UserModel } from './user.model';

export type CanvasSize = {
  width: number;
  height: number;
};

// Print zone (the canvas) relative to the template image, as fractions of its size
export type SavedPrintArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TshirtModel = {
  _id?: string;
  url: string;
  // Capture of the back, only set when the back has designs
  backUrl?: string;
  label: string;
  color?: string;
  category?: string;
  designs?: string[];
  // Designer state at save time
  templateId?: string;
  // Snapshot of the template, still readable if the template list changes
  template?: TemplateModel;
  canvas?: CanvasSize;
  // Where the canvas sits on each captured side of the template
  printAreas?: Partial<Record<DesignSide, SavedPrintArea>>;
  objects?: SavedDesignObject[];
  // Who saved the tshirt; missing for anonymous/older saves. Set by the server
  createdBy?: TshirtCreator;
  createdAt?: string;
};

export type TshirtCreator = Pick<UserModel, '_id' | 'name' | 'username' | 'role'>;

// Mirrors the server rule: the creator or an admin can delete a tshirt
export const canDeleteTshirt = (
  tshirt: Pick<TshirtModel, 'createdBy'>,
  user: Pick<UserModel, '_id' | 'role'> | null,
): boolean =>
  user?.role === 'admin' ||
  (!!user && !!tshirt.createdBy && tshirt.createdBy._id === user._id);

// What the designer sends when saving a tshirt
export type TshirtPayload = Omit<
  TshirtModel,
  '_id' | 'url' | 'backUrl' | 'createdBy' | 'createdAt'
>;
