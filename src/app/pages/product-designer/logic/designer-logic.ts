import interact from 'interactjs';

// Distance (px) under which a dragged design snaps to the horizontal center of the canvas
const SNAP_THRESHOLD = 8;

// Snaps on the X axis only. rawLeft is the unsnapped position, so the design can be pulled out of the snap
const snapLeftToCenterX = (target: HTMLElement, rawLeft: number): number => {
  const canvas = document.getElementById('canvas');
  if (!canvas) return rawLeft;
  // clientWidth excludes the canvas border, offsetWidth includes the design border
  const centerLeft = (canvas.clientWidth - target.offsetWidth) / 2;
  const snapped = Math.abs(rawLeft - centerLeft) <= SNAP_THRESHOLD;
  canvas.classList.toggle('snap-center-x', snapped);
  return snapped ? centerLeft : rawLeft;
};

// Resize only from the bottom-right resize button, never from the design edges
const RESIZE_HANDLE_EDGES = {
  right: '.action-btn.resize',
  bottom: '.action-btn.resize',
};

const hideCenterGuide = () =>
  document.getElementById('canvas')?.classList.remove('snap-center-x');

export const dragReize = (selectedDesign: any) => {
  if (selectedDesign.type === 'text') {
    dragResizeText(selectedDesign);
    return;
  }
  let rawLeft = 0;
  interact(`#${selectedDesign['id']}`)
    .draggable({
      modifiers: [
        // interact.modifiers.restrictRect({
        //   restriction: '#canvas', // Restrict dragging within canvas
        //   endOnly: false, // Only restrict when dragging stops
        // }),
      ],
      listeners: {
        start: () => {
          rawLeft = selectedDesign['left'];
        },
        move: (event) => {
          // Calculate the current position of the logo
          rawLeft += event.dx;
          const newLeft = snapLeftToCenterX(event.target, rawLeft);
          const newTop = selectedDesign['top'] + event.dy;

          // Prevent dragging outside the canvas bounds by checking the new position
          // if (
          //   newLeft >= 0 &&
          //   newLeft + selectedDesign.width <= canvasRect.width &&
          //   newTop >= 0 &&
          //   newTop + selectedDesign.height <= canvasRect.height
          // ) {
          selectedDesign['left'] = newLeft;
          selectedDesign['top'] = newTop;
          event.target.style.left = `${selectedDesign['left']}px`;
          event.target.style.top = `${selectedDesign['top']}px`;
          // }
        },
        end: hideCenterGuide,
      },
    })
    .resizable({
      edges: RESIZE_HANDLE_EDGES,
      modifiers: [
        // Keep the image ratio so the box keeps hugging the image
        interact.modifiers.aspectRatio({ ratio: 'preserve' }),
        interact.modifiers.restrictSize({
          min: { width: 30, height: 30 }, // Min size
          // max: { width: 300, height: 300 }, // Max size
        }),
        // interact.modifiers.restrictEdges({
        //   outer: '#canvas', // Restrict resizing to canvas bounds
        //   endOnly: true,
        // }),
      ],
      listeners: {
        move: (event) => {
          selectedDesign['width'] = event.rect.width;
          selectedDesign.height = event.rect.height;
          selectedDesign['left'] += event.deltaRect.left;
          selectedDesign['top'] += event.deltaRect.top;

          event.target.style.width = `${selectedDesign['width']}px`;
          event.target.style.height = `${selectedDesign.height}px`;
          event.target.style.left = `${selectedDesign['left']}px`;
          event.target.style.top = `${selectedDesign['top']}px`;
        },
      },
    });
};

// Text objects size themselves from their content, so resizing scales the font size instead of the box
const dragResizeText = (selectedDesign: any) => {
  let rawLeft = 0;
  interact(`#${selectedDesign['id']}`)
    .draggable({
      listeners: {
        start: () => {
          rawLeft = selectedDesign['left'];
        },
        move: (event) => {
          rawLeft += event.dx;
          selectedDesign['left'] = snapLeftToCenterX(event.target, rawLeft);
          selectedDesign['top'] += event.dy;
          event.target.style.left = `${selectedDesign['left']}px`;
          event.target.style.top = `${selectedDesign['top']}px`;
        },
        end: hideCenterGuide,
      },
    })
    .resizable({
      edges: RESIZE_HANDLE_EDGES,
      modifiers: [
        interact.modifiers.aspectRatio({ ratio: 'preserve' }),
        interact.modifiers.restrictSize({
          min: { width: 20, height: 20 },
        }),
      ],
      listeners: {
        move: (event) => {
          const previousWidth = event.rect.width - event.deltaRect.width;
          if (previousWidth <= 0) return;
          const factor = event.rect.width / previousWidth;
          const fontSize = Math.min(
            Math.max(selectedDesign.text.fontSize * factor, 10),
            200
          );
          selectedDesign.text.fontSize = Math.round(fontSize * 10) / 10;
          selectedDesign['left'] += event.deltaRect.left;
          selectedDesign['top'] += event.deltaRect.top;

          const textElement = event.target.querySelector(
            '.design-object-text'
          ) as HTMLElement | null;
          if (textElement) {
            textElement.style.fontSize = `${selectedDesign.text.fontSize}px`;
          }
          event.target.style.left = `${selectedDesign['left']}px`;
          event.target.style.top = `${selectedDesign['top']}px`;
        },
        end: (event) => {
          selectedDesign['width'] = event.target.offsetWidth;
          selectedDesign['height'] = event.target.offsetHeight;
        },
      },
    });
};

// Capture resolution: sharp enough when the preview is zoomed, without the cost of a 3x capture
const CAPTURE_SCALE = 2;

export const downloadImageLogic = async (
  className: string
): Promise<string | null> => {
  const element = document.querySelector(className) as HTMLElement;

  if (!element) {
    console.warn(`Element with selector "${className}" not found.`);
    return null;
  }

  // Loaded on the first capture only: keeps html2canvas out of the designer chunk
  const { default: html2canvas } = await import('html2canvas');
  return new Promise((resolve) => {
    html2canvas(element, {
      useCORS: true,
      allowTaint: false,
      // Render at higher resolution so the preview stays sharp when zoomed
      scale: Math.max(window.devicePixelRatio || 1, CAPTURE_SCALE),
      // Transparent background: only the product and its designs are drawn
      backgroundColor: null,
      onclone: (_doc, clonedElement) => {
        clonedElement.style.background = 'transparent';
      },
    })
      .then((canvas) => {
        const base64Url = trimTransparent(canvas).toDataURL('image/png');
        resolve(base64Url); // Return preview URL instead of downloading
      })
      .catch((error) => {
        console.error('html2canvas capture failed:', error);
        resolve(null);
      });
  });
};

// Crop the fully transparent margins around the product
const trimTransparent = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const isEmpty = (x: number, y: number) => data[(y * width + x) * 4 + 3] === 0;
  const rowEmpty = (y: number) => {
    for (let x = 0; x < width; x++) if (!isEmpty(x, y)) return false;
    return true;
  };
  const columnEmpty = (x: number) => {
    for (let y = top; y <= bottom; y++) if (!isEmpty(x, y)) return false;
    return true;
  };

  // Scan inwards from each edge and stop at the first drawn pixel,
  // instead of visiting every pixel of the capture
  let top = 0;
  while (top < height && rowEmpty(top)) top++;
  if (top === height) return canvas; // Nothing drawn
  let bottom = height - 1;
  while (bottom > top && rowEmpty(bottom)) bottom--;
  let left = 0;
  while (left < width - 1 && columnEmpty(left)) left++;
  let right = width - 1;
  while (right > left && columnEmpty(right)) right--;

  const trimmed = document.createElement('canvas');
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed
    .getContext('2d')!
    .drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
};
