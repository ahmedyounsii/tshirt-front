import { Creator, UserModel } from './user.model';

// A design picked to be added to the canvas. A promise while its image is still being
// prepared (e.g. converted to base64): the designer shows a loader from the click
export type DesignToAdd = DesignModel | Promise<DesignModel | null>;

export type DesignModel = {
  _id?: string;
  url: string;
  label?: string;
  // Path stored in the backend ("/uploads/designs/<file>"): the designer replaces
  // url with a base64 copy for the captures, this one is what a product saves
  storedUrl?: string;
  // Number of saved products using this design (sent with the design lists)
  usedCount?: number;
  // Categories the design belongs to (sent with the design lists)
  categoryIds?: string[];
  // Lowercase words that help find the design (search), MAX_PRODUCT_TAGS at most
  tags?: string[];
  // False once its owner hid it from the gallery (products already using it keep it)
  published?: boolean;
  // User who shared the design, credited on it; missing on the shop's own designs. Set by the server
  createdBy?: DesignCreator | null;
};

export type DesignCreator = Creator;

// The user shared this design: like an admin (server rule), they can edit and delete it
export const isDesignOwner = (
  design: Pick<DesignModel, 'createdBy'>,
  user: Pick<UserModel, '_id'> | null,
): boolean => !!user && !!design.createdBy && design.createdBy._id === user._id;
