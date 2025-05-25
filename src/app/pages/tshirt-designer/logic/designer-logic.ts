import html2canvas from 'html2canvas';
import interact from 'interactjs';

export const dragReize = (selectedDesign: any) => {
  interact(`#${selectedDesign['id']}`)
    .draggable({
      modifiers: [
        // interact.modifiers.restrictRect({
        //   restriction: '#canvas', // Restrict dragging within canvas
        //   endOnly: false, // Only restrict when dragging stops
        // }),
      ],
      listeners: {
        move: (event) => {
          // Calculate the current position of the logo
          const newLeft = selectedDesign['left'] + event.dx;
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
      },
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      modifiers: [
        interact.modifiers.aspectRatio({ ratio: 1 }), // Enforce square resizing
        interact.modifiers.restrictSize({
          min: { width: 50, height: 50 }, // Min size
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

export const downloadImageLogic = (className: any) => {
  const element = document.querySelector(className) as HTMLElement;

  if (element) {
    html2canvas(element).then((canvas) => {
      const link = document.createElement('a');
      link.download = 'capture.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  }
};
export const getImageBlob = async (className: string): Promise<Blob | null> => {
  const element = document.querySelector(className) as HTMLElement;

  if (!element) {
    console.warn('Element not found');
    return null;
  }

  try {
    const canvas = await html2canvas(element);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          console.error('Failed to convert canvas to Blob');
          resolve(null);
        }
      }, 'image/png');
    });
  } catch (error) {
    console.error('Error capturing element:', error);
    return null;
  }
};
