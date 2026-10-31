import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../../components/icon/icon.component';

// The server renders the PC keys, the browser switches to the Mac ones
const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

// Ctrl on PC, ⌘ on Mac: also used by the toolbar tooltips
export const modKey = (): string => (isMac() ? '⌘' : 'Ctrl');

// A key cap, or a word between the caps ("drag")
type ShortcutKey = { cap: string } | { word: string };

type Shortcut = { id: string; keys: ShortcutKey[] };

type ShortcutGroup = { id: string; shortcuts: Shortcut[] };

const shortcutGroups = (mac: boolean): ShortcutGroup[] => {
  const mod = { cap: mac ? '⌘' : 'Ctrl' };
  const shift = { cap: mac ? '⇧' : 'Shift' };
  const arrows = { cap: '← ↑ ↓ →' };
  return [
    {
      id: 'edit',
      shortcuts: [
        { id: 'undo', keys: [mod, { cap: 'Z' }] },
        { id: 'redo', keys: [mod, { cap: 'Y' }] },
        { id: 'duplicate', keys: [mod, { cap: 'D' }] },
        { id: 'remove', keys: [{ cap: mac ? '⌫' : 'Del' }] },
      ],
    },
    {
      id: 'move',
      shortcuts: [
        { id: 'nudge', keys: [arrows] },
        { id: 'nudgeFar', keys: [shift, arrows] },
        { id: 'freeDrag', keys: [{ cap: mac ? '⌥' : 'Alt' }, { word: 'drag' }] },
        { id: 'deselect', keys: [{ cap: 'Esc' }] },
      ],
    },
  ];
};

// Keyboard shortcuts of the designer, at the bottom of the empty side panel
@Component({
    selector: 'app-shortcuts-card',
    imports: [IconComponent, TranslatePipe],
    templateUrl: './shortcuts-card.component.html',
    styleUrl: './shortcuts-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShortcutsCardComponent {
  // Rendered like on the server (PC keys), then adapted once in the browser
  readonly groups = signal(shortcutGroups(false));
  // Always open on load; folding only lasts until the page is left
  readonly open = signal(true);

  constructor() {
    afterNextRender(() => this.groups.set(shortcutGroups(isMac())));
  }

  toggle() {
    this.open.update((open) => !open);
  }

  isCap(key: ShortcutKey): key is { cap: string } {
    return 'cap' in key;
  }
}
