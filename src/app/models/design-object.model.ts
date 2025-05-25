import { DesignModel } from './design.model';

export type designObject = {
  id: string;
  url: any;
  width: number;
  height: number;
  left: number;
  top: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  design?: DesignModel;
};
