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
};
