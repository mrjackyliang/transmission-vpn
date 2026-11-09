import {
  useEffect,
  useRef,
} from 'react';

import type { MutableRefObject } from 'react';

// Open layers in the order they appeared; only the topmost one reacts to Escape.

/**
 * Use Escape Key - Layer stack.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const layerStack: Array<() => void> = [];

/**
 * Use Escape Key - Handles key down.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape') {
    return;
  }

  const topLayer: (() => void) | undefined = layerStack.at(-1);

  if (topLayer !== undefined) {
    event.preventDefault();
    topLayer();
  }
};

/**
 * Use Escape Key - Use Escape Key.
 *
 * Closes a dialog or panel when Escape is pressed, but only while it is the
 * topmost open layer, so a picker opened on top of a dialog closes first.
 *
 * @param {() => void} onClose - On close.
 * @param {boolean}    active  - Active.
 *
 * @since 2.0.0
 */
export const useEscapeKey = (onClose: () => void, active: boolean): void => {
  const latestOnClose: MutableRefObject<() => void> = useRef(onClose);

  latestOnClose.current = onClose;

  useEffect((): (() => void) | undefined => {
    if (!active) {
      return undefined;
    }

    /**
     * Use Escape Key - Layer.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @since 2.0.0
     */
    const layer = (): void => latestOnClose.current();

    if (layerStack.length === 0) {
      window.addEventListener('keydown', handleKeyDown);
    }

    layerStack.push(layer);

    return (): void => {
      const index: number = layerStack.lastIndexOf(layer);

      if (index >= 0) {
        layerStack.splice(index, 1);
      }

      if (layerStack.length === 0) {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [active]);
};
