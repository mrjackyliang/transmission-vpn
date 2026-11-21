import {
  useEffect,
  useRef,
} from 'react';

import type {
  Web_UseEscapeKey_HandleKeyDown_Event,
  Web_UseEscapeKey_HandleKeyDown_Returns,
  Web_UseEscapeKey_HandleKeyDown_TopLayer,
  Web_UseEscapeKey_LayerStack,
  Web_UseEscapeKey_UseEscapeKey_Active,
  Web_UseEscapeKey_UseEscapeKey_Index,
  Web_UseEscapeKey_UseEscapeKey_LatestOnClose,
  Web_UseEscapeKey_UseEscapeKey_Layer,
  Web_UseEscapeKey_UseEscapeKey_Layer_Returns,
  Web_UseEscapeKey_UseEscapeKey_OnClose,
  Web_UseEscapeKey_UseEscapeKey_Returns,
} from '@/types/web/use-escape-key.d.ts';

// Open layers in the order they appeared; only the topmost one reacts to Escape.

/**
 * Use Escape Key - Layer Stack.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const layerStack: Web_UseEscapeKey_LayerStack = [];

/**
 * Use Escape Key - Handle Key Down.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_UseEscapeKey_HandleKeyDown_Event} event - Event.
 *
 * @returns {Web_UseEscapeKey_HandleKeyDown_Returns}
 *
 * @since 2.0.0
 */
const handleKeyDown = (event: Web_UseEscapeKey_HandleKeyDown_Event): Web_UseEscapeKey_HandleKeyDown_Returns => {
  if (event.key !== 'Escape') {
    return;
  }

  const topLayer: Web_UseEscapeKey_HandleKeyDown_TopLayer = layerStack.at(-1);

  if (topLayer !== undefined) {
    event.preventDefault();

    topLayer();
  }

  return;
};

/**
 * Use Escape Key - Use Escape Key.
 *
 * Closes a dialog or panel when Escape is pressed, but only while it is the
 * topmost open layer, so a picker opened on top of a dialog closes first.
 *
 * @param {Web_UseEscapeKey_UseEscapeKey_OnClose} onClose - On close.
 * @param {Web_UseEscapeKey_UseEscapeKey_Active}  active  - Active.
 *
 * @returns {Web_UseEscapeKey_UseEscapeKey_Returns}
 *
 * @since 2.0.0
 */
export const useEscapeKey = (onClose: Web_UseEscapeKey_UseEscapeKey_OnClose, active: Web_UseEscapeKey_UseEscapeKey_Active): Web_UseEscapeKey_UseEscapeKey_Returns => {
  const latestOnClose: Web_UseEscapeKey_UseEscapeKey_LatestOnClose = useRef(onClose);

  latestOnClose.current = onClose;

  useEffect(() => {
    if (active === false) {
      return undefined;
    }

    /**
     * Use Escape Key - Layer.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @returns {Web_UseEscapeKey_UseEscapeKey_Layer_Returns}
     *
     * @since 2.0.0
     */
    const layer: Web_UseEscapeKey_UseEscapeKey_Layer = (): Web_UseEscapeKey_UseEscapeKey_Layer_Returns => latestOnClose.current();

    if (layerStack.length === 0) {
      window.addEventListener('keydown', handleKeyDown);
    }

    layerStack.push(layer);

    return () => {
      const index: Web_UseEscapeKey_UseEscapeKey_Index = layerStack.lastIndexOf(layer);

      if (index >= 0) {
        layerStack.splice(index, 1);
      }

      if (layerStack.length === 0) {
        window.removeEventListener('keydown', handleKeyDown);
      }

      return;
    };
  }, [active]);

  return;
};
