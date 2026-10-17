export type TemplateModel = {
  id: string;
  ref: string;
  type: string;
  frontImg: string;
  // Templates without a back image can only be designed from the front
  backImg?: string;
  color: string;
  colorLabel: string;
  style?: string;
};
