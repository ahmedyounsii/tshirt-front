import { Injectable } from '@angular/core';
import { DesignModel } from '../../../../models/design.model';
import { ChipItem } from '../../../../components/category-chips/category-chips.component';
import { environment } from '../../../../../environments/environment';

// Designs fetched per page
export const DESIGNS_PAGE_SIZE = 10;
// Very tall or wide images are shown inside a tile of this ratio range
const MIN_RATIO = 0.5;
const MAX_RATIO = 2;
// A slow image doesn't hold the whole page: it gets a square tile
const RATIO_TIMEOUT_MS = 3000;

// Width / height of the image, so its tile gets its final height before the image shows
export type MasonryDesign = DesignModel & { ratio: number };

// Designs loaded for one category + search
export type LoadedDesigns = {
  key: string;
  designs: MasonryDesign[];
  count: number;
  page: number;
  scrollTop: number;
};

export const designsKey = (category: string, search: string) =>
  `${category}|${search}`;

// Design of the API, with the full url of its image
export const toDesign = (design: any): DesignModel => ({
  ...design,
  url: `${environment.baseUrl}${design.url}`,
  storedUrl: design.url,
});

// Reads the images' size first (they are then cached for the tiles)
export function withRatios(items: DesignModel[]): Promise<MasonryDesign[]> {
  return Promise.all(
    items.map(
      (item) =>
        new Promise<MasonryDesign>((resolve) => {
          const img = new Image();
          const done = () => {
            clearTimeout(timer);
            const ratio =
              img.naturalWidth && img.naturalHeight
                ? img.naturalWidth / img.naturalHeight
                : 1;
            resolve({
              ...item,
              ratio: Math.min(Math.max(ratio, MIN_RATIO), MAX_RATIO),
            });
          };
          const timer = setTimeout(done, RATIO_TIMEOUT_MS);
          img.onload = img.onerror = done;
          img.src = item.url;
        }),
    ),
  );
}

// The graphics panel is destroyed whenever another tool opens or the panel closes:
// its state lives here so reopening it shows the same list, without reloading.
// Provided by the designer page, so it's dropped when leaving the designer
@Injectable()
export class DesignsDisplayerState {
  selectedCategory: string | null = null;
  inputText = '';
  search = '';
  chips: ChipItem[] | null = null;
  loaded: LoadedDesigns | null = null;
  // Converted images, so picking the same design again is instant
  base64Cache = new Map<string, Promise<string>>();
}
