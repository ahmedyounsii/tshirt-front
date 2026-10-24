// Renders the grunge edge off the page: the sliders and buttons stay responsive while it works
import {
  fitSize,
  GrungeRenderer,
  GrungeRequest,
  GrungeResponse,
  renderGrungeFile,
} from '../../../../shared/grunge-edge';

// The app compiles with the DOM types: the worker scope is typed by hand
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<GrungeRequest>) => void) | null;
  postMessage(message: GrungeResponse, transfer?: Transferable[]): void;
};

const renderer = new GrungeRenderer();
let src: ImageBitmap | null = null;

scope.onmessage = async ({ data }) => {
  switch (data.type) {
    case 'source':
      src?.close();
      src = data.bitmap;
      renderer.clearCache();
      break;
    case 'preview': {
      if (!src) return;
      const [w, h] = fitSize(src, data.max);
      const bitmap = renderer.render(src, w, h, data.params, data.seed).transferToImageBitmap();
      scope.postMessage({ type: 'preview', id: data.id, bitmap }, [bitmap]);
      break;
    }
    case 'export': {
      const file = src ? await renderGrungeFile(src, data.params, data.seed, data.name) : null;
      scope.postMessage({ type: 'export', id: data.id, file });
      break;
    }
  }
};
