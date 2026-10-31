import interact from 'interactjs';
import { trimTransparent } from '../../../shared/download-canvas';
import { paintTextCanvas } from '../../../shared/text-render';
import { editorTextRatio } from '../../../shared/text-canvas.directive';

// Distance (px) under which a dragged design snaps to a guide
const SNAP_THRESHOLD = 6;

type Axis = 'x' | 'y';
type Position = { left: number; top: number };

// Snaps the center of the design to the canvas center when within the threshold.
// raw is the unsnapped position, so the design can be pulled out of a snap
const snapAxis = (
  canvas: HTMLElement,
  target: HTMLElement,
  axis: Axis,
  raw: number,
): { value: number; line: number | null } => {
  const line = (axis === 'x' ? canvas.clientWidth : canvas.clientHeight) / 2;
  // offsetWidth includes the design border
  const length = axis === 'x' ? target.offsetWidth : target.offsetHeight;
  const shift = line - (raw + length / 2);
  return Math.abs(shift) <= SNAP_THRESHOLD ? { value: raw + shift, line } : { value: raw, line: null };
};

// Guide line drawn while a design is snapped on that axis. Created here, so styled inline,
// and left out of the captures
const showGuide = (canvas: HTMLElement, axis: Axis, line: number | null) => {
  let guide = canvas.querySelector<HTMLElement>(`.snap-guide-${axis}`);
  if (!guide) {
    if (line === null) return;
    guide = document.createElement('div');
    guide.className = `snap-guide-${axis}`;
    guide.setAttribute('data-html2canvas-ignore', '');
    Object.assign(guide.style, {
      position: 'absolute',
      background: 'var(--sp-primary-500)',
      pointerEvents: 'none',
      zIndex: '1000',
      ...(axis === 'x'
        ? { top: '0', bottom: '0', width: '1px', transform: 'translateX(-50%)' }
        : { left: '0', right: '0', height: '1px', transform: 'translateY(-50%)' }),
    });
    canvas.appendChild(guide);
  }
  guide.style.display = line === null ? 'none' : 'block';
  if (line !== null) guide.style[axis === 'x' ? 'left' : 'top'] = `${line}px`;
};

const hideGuides = () => {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  showGuide(canvas, 'x', null);
  showGuide(canvas, 'y', null);
};

// Holding Alt moves the design freely
const snapPosition = (target: HTMLElement, raw: Position, free: boolean): Position => {
  const canvas = document.getElementById('canvas');
  if (!canvas || free) {
    hideGuides();
    return raw;
  }
  const x = snapAxis(canvas, target, 'x', raw.left);
  const y = snapAxis(canvas, target, 'y', raw.top);
  showGuide(canvas, 'x', x.line);
  showGuide(canvas, 'y', y.line);
  return { left: x.value, top: y.value };
};

// Resize only from the bottom-right resize button, never from the design edges
const RESIZE_HANDLE_EDGES = {
  right: '.action-btn.resize',
  bottom: '.action-btn.resize',
};

// Size limits shared by the resize button and the size slider.
// An image's size is its longest side (px), a text's size is its font size (px)
export const IMAGE_SIZE_LIMITS = { min: 20, max: 500 };
export const FONT_SIZE_LIMITS = { min: 10, max: 120 };

// Box with the design ratio whose longest side is size
export const boxWithLongestSide = (design: any, size: number) => {
  const ratio = design.width / design.height;
  return ratio >= 1
    ? { width: size, height: size / ratio }
    : { width: size * ratio, height: size };
};

const clamp = (value: number, limits: { min: number; max: number }) =>
  Math.min(Math.max(value, limits.min), limits.max);

// Text objects size themselves from their content: draw the text again right away,
// so its new size can be measured before Angular renders
const applyFontSize = (design: any, element: HTMLElement | null) => {
  const textCanvas = element?.querySelector<HTMLCanvasElement>('canvas.design-object-text');
  if (textCanvas) paintTextCanvas(textCanvas, design.text, editorTextRatio());
};

const measuredSize = (design: any, element: HTMLElement | null) =>
  design.type === 'text' && element
    ? { width: element.offsetWidth, height: element.offsetHeight }
    : { width: design.width, height: design.height };

// Runs resize (which changes the design size), then moves the design so its center stays in place
export const resizeAroundCenter = (design: any, resize: () => void) => {
  const element = document.getElementById(design.id);
  const before = measuredSize(design, element);
  resize();
  if (design.type === 'text') applyFontSize(design, element);
  const after = measuredSize(design, element);
  design.left -= (after.width - before.width) / 2;
  design.top -= (after.height - before.height) / 2;
};

// Resize from the resize button around the design center: the size follows the pointer
// distance to the center, so the design grows on all sides and doesn't move
const centeredResize = (
  selectedDesign: any,
  sizeOf: () => number,
  setSize: (size: number) => void
) => {
  let center = { x: 0, y: 0 };
  let startDistance = 0;
  let startSize = 0;
  const distanceToCenter = (event: any) =>
    Math.hypot(event.client.x - center.x, event.client.y - center.y);
  return {
    edges: RESIZE_HANDLE_EDGES,
    listeners: {
      start: (event: any) => {
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        startDistance = distanceToCenter(event);
        startSize = sizeOf();
      },
      move: (event: any) => {
        if (startDistance < 1) return;
        resizeAroundCenter(selectedDesign, () =>
          setSize((startSize * distanceToCenter(event)) / startDistance)
        );
        event.target.style.width =
          selectedDesign.type === 'text' ? '' : `${selectedDesign.width}px`;
        event.target.style.height =
          selectedDesign.type === 'text' ? '' : `${selectedDesign.height}px`;
        event.target.style.left = `${selectedDesign.left}px`;
        event.target.style.top = `${selectedDesign.top}px`;
      },
      end: (event: any) => {
        if (selectedDesign.type !== 'text') return;
        selectedDesign.width = event.target.offsetWidth;
        selectedDesign.height = event.target.offsetHeight;
      },
    },
  };
};

// The rotate button turns the design: dragging the design never starts from it
const ROTATE_HANDLE = '.action-btn.rotate';
// Holding Shift turns by steps of this angle (deg)
const ROTATE_SNAP_STEP = 15;
// Angle (deg) under which the rotation snaps to a right angle (0, 90, 180, -90)
const RIGHT_ANGLE_SNAP_THRESHOLD = 5;

// Snaps to the closest right angle when within the threshold
const snapToRightAngle = (rotation: number) => {
  const rightAngle = Math.round(rotation / 90) * 90;
  return Math.abs(rotation - rightAngle) <= RIGHT_ANGLE_SNAP_THRESHOLD ? rightAngle : rotation;
};

// Same range as the rotation slider: -180 to 180
const normalizeAngle = (angle: number) => ((((angle + 180) % 360) + 360) % 360) - 180;

// Rotate from the rotate button around the design center: the rotation follows the pointer
// angle around the center. The whole design turns, its box and buttons with it.
// Applied to the DOM right away, Angular renders it on pointerup
export const rotateFromHandle = (selectedDesign: any, event: PointerEvent) => {
  const element = document.getElementById(selectedDesign.id);
  const handle = event.currentTarget as HTMLElement | null;
  if (!element || !handle) return;
  event.preventDefault();
  // A rotated box's bounding rect keeps the same center
  const rect = element.getBoundingClientRect();
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const angleOf = (e: PointerEvent) =>
    (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI;
  const startAngle = angleOf(event);
  const startRotation = selectedDesign.rotation;

  const move = (e: PointerEvent) => {
    let rotation = startRotation + angleOf(e) - startAngle;
    // Holding Alt turns freely, like dragging
    if (e.shiftKey) rotation = Math.round(rotation / ROTATE_SNAP_STEP) * ROTATE_SNAP_STEP;
    else if (!e.altKey) rotation = snapToRightAngle(rotation);
    selectedDesign.rotation = Math.round(normalizeAngle(rotation));
    element.style.transform = `rotate(${selectedDesign.rotation}deg)`;
  };
  const end = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
  };
  // Captured: the moves keep coming when the pointer leaves the button
  handle.setPointerCapture(event.pointerId);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
};

export const dragReize = (selectedDesign: any) => {
  if (selectedDesign.type === 'text') {
    dragResizeText(selectedDesign);
    return;
  }
  let raw: Position = { left: 0, top: 0 };
  interact(`#${selectedDesign['id']}`)
    .draggable({
      ignoreFrom: ROTATE_HANDLE,
      modifiers: [
        // interact.modifiers.restrictRect({
        //   restriction: '#canvas', // Restrict dragging within canvas
        //   endOnly: false, // Only restrict when dragging stops
        // }),
      ],
      listeners: {
        start: () => {
          raw = { left: selectedDesign['left'], top: selectedDesign['top'] };
        },
        move: (event) => {
          // Calculate the current position of the logo
          raw = { left: raw.left + event.dx, top: raw.top + event.dy };
          const { left: newLeft, top: newTop } = snapPosition(event.target, raw, event.altKey);

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
        end: hideGuides,
      },
    })
    .resizable(
      centeredResize(
        selectedDesign,
        () => Math.max(selectedDesign.width, selectedDesign.height),
        // Both sides from the longest one, so the box keeps hugging the image
        (size) =>
          Object.assign(
            selectedDesign,
            boxWithLongestSide(selectedDesign, clamp(size, IMAGE_SIZE_LIMITS))
          )
      )
    );
};

// Text objects size themselves from their content, so resizing scales the font size instead of the box
const dragResizeText = (selectedDesign: any) => {
  let raw: Position = { left: 0, top: 0 };
  interact(`#${selectedDesign['id']}`)
    .draggable({
      ignoreFrom: ROTATE_HANDLE,
      listeners: {
        start: () => {
          raw = { left: selectedDesign['left'], top: selectedDesign['top'] };
        },
        move: (event) => {
          raw = { left: raw.left + event.dx, top: raw.top + event.dy };
          const { left, top } = snapPosition(event.target, raw, event.altKey);
          selectedDesign['left'] = left;
          selectedDesign['top'] = top;
          event.target.style.left = `${selectedDesign['left']}px`;
          event.target.style.top = `${selectedDesign['top']}px`;
        },
        end: hideGuides,
      },
    })
    .resizable(
      centeredResize(
        selectedDesign,
        () => selectedDesign.text.fontSize,
        (size) =>
          (selectedDesign.text.fontSize =
            Math.round(clamp(size, FONT_SIZE_LIMITS) * 10) / 10)
      )
    );
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
