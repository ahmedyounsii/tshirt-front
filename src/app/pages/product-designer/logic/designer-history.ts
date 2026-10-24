import { designObject, DesignSide } from '../../../models/design-object.model';

// Undo steps kept: older ones are dropped
const MAX_STEPS = 50;

type Snapshot = designObject[];

// Undo/redo of the designer objects. A step is recorded by checkpoint() once an
// action is over (drag end, slider release, typing pause...), only if something changed
export class DesignerHistory {
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private current: Snapshot | null = null;

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  // Starts over from these objects, e.g. once a saved product is loaded
  reset(objects: designObject[]) {
    this.past = [];
    this.future = [];
    this.current = clone(objects);
  }

  checkpoint(objects: designObject[]) {
    const snapshot = clone(objects);
    if (this.current && sameSnapshot(this.current, snapshot)) return;
    if (this.current) this.past.push(this.current);
    if (this.past.length > MAX_STEPS) this.past.shift();
    this.future = [];
    this.current = snapshot;
  }

  // Updates the current step without adding one: for changes the user didn't make
  // (an image box shrunk to its ratio once loaded)
  amend(objects: designObject[]) {
    if (this.current) this.current = clone(objects);
  }

  // The objects to show, as copies the designer can freely mutate
  undo(): designObject[] | null {
    const previous = this.past.pop();
    if (!previous) return null;
    if (this.current) this.future.push(this.current);
    this.current = previous;
    return clone(previous);
  }

  redo(): designObject[] | null {
    const next = this.future.pop();
    if (!next) return null;
    if (this.current) this.past.push(this.current);
    this.current = next;
    return clone(next);
  }
}

// Designs (and their base64 urls) are shared: they are never mutated, only replaced
const clone = (objects: designObject[]): Snapshot =>
  objects.map((d) => ({ ...d, text: d.text && { ...d.text } }));

const sameSnapshot = (a: Snapshot, b: Snapshot): boolean =>
  a.length === b.length && a.every((d, i) => sameObject(d, b[i]));

const sameObject = (a: designObject, b: designObject): boolean =>
  a.id === b.id &&
  a.side === b.side &&
  a.url === b.url &&
  // Uploads get a new design object (same local url) once stored on save
  a.design?.url === b.design?.url &&
  a.left === b.left &&
  a.top === b.top &&
  a.rotation === b.rotation &&
  a.flipX === b.flipX &&
  a.flipY === b.flipY &&
  // Texts size themselves from their content: their box is only measured on save
  (a.type === 'text' || (a.width === b.width && a.height === b.height)) &&
  JSON.stringify(a.text) === JSON.stringify(b.text) &&
  JSON.stringify(a.filter) === JSON.stringify(b.filter);

// Sides whose objects differ between two states of the designer
export const changedSides = (before: designObject[], after: designObject[]): DesignSide[] => {
  const sides = new Set<DesignSide>();
  const beforeById = new Map(before.map((d) => [d.id, d]));
  const afterIds = new Set(after.map((d) => d.id));
  for (const d of after) {
    const previous = beforeById.get(d.id);
    if (!previous || !sameObject(previous, d)) sides.add(d.side ?? 'front');
  }
  for (const d of before) if (!afterIds.has(d.id)) sides.add(d.side ?? 'front');
  // A reorder keeps every object as it was
  if (sides.size === 0 && !sameSnapshot(before, after)) {
    for (const d of after) sides.add(d.side ?? 'front');
  }
  return [...sides];
};
