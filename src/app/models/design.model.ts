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
