import { NgZone } from '@angular/core';
import interact from 'interactjs';
import {
  boxWithLongestSide,
  dragReize,
  FONT_SIZE_LIMITS,
  IMAGE_SIZE_LIMITS,
  resizeAroundCenter,
} from './designer-logic';

// Same layout as the designer: a canvas holding the design, the resize button sticking
// out of its bottom-right corner
const mount = (design: any) => {
  const canvas = document.createElement('div');
  canvas.id = 'canvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '800px',
    height: '800px',
  });
  const element = document.createElement('div');
  element.id = design.id;
  element.className = 'design-object';
  Object.assign(element.style, {
    position: 'absolute',
    left: `${design.left}px`,
    top: `${design.top}px`,
    ...(design.type === 'text'
      ? { padding: '2px 4px' }
      : { width: `${design.width}px`, height: `${design.height}px` }),
  });
  if (design.type === 'text') {
    const span = document.createElement('span');
    span.className = 'design-object-text';
    Object.assign(span.style, {
      display: 'block',
      whiteSpace: 'pre',
      lineHeight: '1.2',
      fontSize: `${design.text.fontSize}px`,
    });
    span.textContent = design.text.content;
    element.appendChild(span);
  }
  const button = document.createElement('button');
  button.className = 'action-btn resize';
  Object.assign(button.style, {
    position: 'absolute',
    right: '0',
    bottom: '0',
    width: '30px',
    height: '30px',
    transform: 'translate(100%, 100%)',
  });
  element.appendChild(button);
  canvas.appendChild(element);
  document.body.appendChild(canvas);
  return { canvas, element, button };
};

const pointer = (type: string, x: number, y: number, target: EventTarget) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    })
  );

const centerOf = (rect: DOMRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

// Drags the resize button by steps toward (dx, dy) from its center
const dragHandle = (button: HTMLElement, dx: number, dy: number, steps = 10) => {
  const start = centerOf(button.getBoundingClientRect());
  pointer('pointerdown', start.x, start.y, button);
  for (let i = 1; i <= steps; i++) {
    pointer('pointermove', start.x + (dx * i) / steps, start.y + (dy * i) / steps, document);
  }
  pointer('pointerup', start.x + dx, start.y + dy, document);
};

const imageDesign = (overrides: any = {}) => ({
  id: `d${Math.random().toString(36).slice(2)}`,
  type: 'image',
  left: 200,
  top: 200,
  width: 100,
  height: 150,
  rotation: 0,
  ...overrides,
});

const textDesign = () => ({
  id: `t${Math.random().toString(36).slice(2)}`,
  type: 'text',
  left: 200,
  top: 200,
  width: 0,
  height: 0,
  rotation: 0,
  text: { content: 'Hello', fontSize: 32 },
});

describe('designer-logic resize', () => {
  // One zone for the whole file, like the app: interact.js listens on the document from
  // its first use, in the zone it was used in
  const zone = new NgZone({ enableLongStackTrace: false });
  let mounted: { canvas: HTMLElement; element: HTMLElement; button: HTMLElement }[] = [];

  // Bound outside Angular, like the designer does
  const bind = (design: any) => {
    const m = mount(design);
    mounted.push(m);
    zone.runOutsideAngular(() => dragReize(design));
    return m;
  };

  afterEach(() => {
    for (const m of mounted) {
      interact(m.element).unset();
      m.canvas.remove();
    }
    mounted = [];
  });

  describe('boxWithLongestSide', () => {
    it('keeps the ratio of a portrait box', () => {
      expect(boxWithLongestSide({ width: 100, height: 200 }, 50)).toEqual({ width: 25, height: 50 });
    });
    it('keeps the ratio of a landscape box', () => {
      expect(boxWithLongestSide({ width: 200, height: 100 }, 50)).toEqual({ width: 50, height: 25 });
    });
  });

  describe('resizeAroundCenter (slider)', () => {
    it('keeps the center of an image', () => {
      const design = imageDesign();
      resizeAroundCenter(design, () => Object.assign(design, boxWithLongestSide(design, 300)));
      expect(design.width).toBeCloseTo(200);
      expect(design.height).toBeCloseTo(300);
      expect(design.left + design.width / 2).toBeCloseTo(250);
      expect(design.top + design.height / 2).toBeCloseTo(275);
    });

    it('keeps the center of a text', () => {
      const design = textDesign();
      const { element } = mount(design);
      mounted.push({ canvas: element.parentElement!, element, button: element.querySelector('button')! });
      const before = centerOf(element.getBoundingClientRect());
      resizeAroundCenter(design, () => (design.text.fontSize = 80));
      element.style.left = `${design.left}px`;
      element.style.top = `${design.top}px`;
      const after = element.getBoundingClientRect();
      expect(after.width).toBeGreaterThan(100);
      expect(centerOf(after).x).toBeCloseTo(before.x, 0);
      expect(centerOf(after).y).toBeCloseTo(before.y, 0);
    });
  });

  describe('resize button', () => {
    it('grows an image around its center, keeping its ratio', () => {
      const design = imageDesign();
      const { element, button } = bind(design);
      const before = centerOf(element.getBoundingClientRect());
      dragHandle(button, 40, 60);
      const after = element.getBoundingClientRect();
      expect(design.width).toBeGreaterThan(100);
      expect(design.width / design.height).toBeCloseTo(100 / 150, 5);
      expect(after.width).toBeCloseTo(design.width, 0);
      expect(centerOf(after).x).toBeCloseTo(before.x, 0);
      expect(centerOf(after).y).toBeCloseTo(before.y, 0);
    });

    it('shrinks an image around its center without squashing it', () => {
      const design = imageDesign();
      const { element, button } = bind(design);
      const before = centerOf(element.getBoundingClientRect());
      dragHandle(button, -95, -130, 20);
      expect(Math.max(design.width, design.height)).toBeGreaterThanOrEqual(IMAGE_SIZE_LIMITS.min - 1e-9);
      expect(design.width / design.height).toBeCloseTo(100 / 150, 5);
      const after = centerOf(element.getBoundingClientRect());
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
    });

    it('stops an image at the slider minimum and maximum', () => {
      const small = imageDesign();
      const s = bind(small);
      const c = centerOf(s.element.getBoundingClientRect());
      const b = centerOf(s.button.getBoundingClientRect());
      // Right next to the center: far below the minimum
      dragHandle(s.button, c.x - b.x + 1, c.y - b.y + 1);
      expect(Math.max(small.width, small.height)).toBeCloseTo(IMAGE_SIZE_LIMITS.min, 5);

      const big = imageDesign();
      const g = bind(big);
      dragHandle(g.button, 1000, 1500);
      expect(Math.max(big.width, big.height)).toBeCloseTo(IMAGE_SIZE_LIMITS.max, 5);
    });

    it('scales a text font size around its center, within the slider limits', () => {
      const design = textDesign();
      const { element, button } = bind(design);
      const before = centerOf(element.getBoundingClientRect());
      dragHandle(button, 30, 15);
      expect(design.text.fontSize).toBeGreaterThan(32);
      const after = centerOf(element.getBoundingClientRect());
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
      // Size kept on release, used by the undo history and the captures
      expect(design.width).toBe(element.offsetWidth);

      dragHandle(button, 3000, 3000);
      expect(design.text.fontSize).toBe(FONT_SIZE_LIMITS.max);
    });

    it('resizes again from where the last resize ended', () => {
      const design = imageDesign();
      const { button } = bind(design);
      dragHandle(button, 40, 60);
      const first = design.width;
      dragHandle(button, 40, 60);
      expect(design.width).toBeGreaterThan(first);
    });
  });

  describe('performance', () => {
    const MOVES = 500;

    const timeMoves = (design: any) => {
      const { button } = bind(design);
      const start = centerOf(button.getBoundingClientRect());
      pointer('pointerdown', start.x, start.y, button);
      pointer('pointermove', start.x + 1, start.y + 1, document);
      const t0 = performance.now();
      for (let i = 0; i < MOVES; i++) {
        const d = 40 * Math.sin(i / 20);
        pointer('pointermove', start.x + d, start.y + d, document);
      }
      const perMove = (performance.now() - t0) / MOVES;
      pointer('pointerup', start.x, start.y, document);
      return perMove;
    };

    it('reports the cost of a resize move', () => {
      const image = timeMoves(imageDesign());
      const text = timeMoves(textDesign());
      console.log(
        `[perf] resize move (incl. interact.js + style recalc): image ${image.toFixed(3)} ms, text ${text.toFixed(3)} ms`
      );
      // A frame is 16 ms: a move must stay far below it
      expect(image).toBeLessThan(2);
      expect(text).toBeLessThan(4);
    });

    it('runs no Angular change detection on pointer moves', () => {
      const design = imageDesign();
      const { button } = bind(design);
      let turns = 0;
      const sub = zone.onMicrotaskEmpty.subscribe(() => turns++);
      const start = centerOf(button.getBoundingClientRect());

      // Not resizing: the pointer just crosses the page
      turns = 0;
      for (let i = 0; i < 50; i++) pointer('pointermove', 10 + i, 10, document);
      const idle = turns;

      pointer('pointerdown', start.x, start.y, button);
      turns = 0;
      for (let i = 0; i < 50; i++) pointer('pointermove', start.x + i, start.y + i, document);
      const resizing = turns;
      pointer('pointerup', start.x, start.y, document);
      sub.unsubscribe();

      expect(idle).toBe(0);
      expect(resizing).toBe(0);
    });
  });
});
