import { DesignModel } from './design.model';

export type DesignCategoryModel = {
  _id: string;
  label: string;
  designs?: DesignModel[];
};
