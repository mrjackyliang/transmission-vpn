import {
  useEffect,
  useRef,
} from 'react';

import { PHONE_NAV_SHEET_ID } from '@/web/navigation.ts';
import { Icon } from '@/web/primitives.tsx';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  ReactElement,
  RefObject,
} from 'react';

import type { Web_NavSheet_Props } from '@/types/web/nav-sheet.d.ts';
import type {
  Web_Navigation_SheetGroup,
  Web_Navigation_SheetRow,
} from '@/types/web/navigation.d.ts';

/**
 * Nav Sheet.
 *
 * Presents navigation rows or page content in a focus-managed phone sheet.
 * Nested More items reuse the same dialog while the pure stack owns its level.
 *
 * @param {Web_NavSheet_Props} props - Props.
 *
 * @returns {ReactElement}
 *
 * @since 2.0.0
 */
export const NavSheet = ({
  activeView,
  children,
  level,
  onBack,
  onClose,
  onNavigate,
  onPush,
}: Web_NavSheet_Props): ReactElement => {
  const focusKey: string = level['id'];
  const dialogRef: RefObject<HTMLElement | null> = useDialogFocus(true, focusKey);
  const headingRef: RefObject<HTMLHeadingElement | null> = useRef<HTMLHeadingElement | null>(null);

  useEscapeKey(onClose, true);

  useEffect((): void => {
    const heading: HTMLHeadingElement | null = headingRef.current;

    if (heading !== null) {
      heading.focus();
    }
  }, [focusKey]);

  return (
    <>
      <button
        aria-label="Close navigation"
        className="nav-sheet-scrim"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-label={level['title']}
        className="nav-sheet"
        id={PHONE_NAV_SHEET_ID}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {(level['parentTitle'] === undefined) ? null : (
          <button className="nav-sheet-back" onClick={onBack} type="button">
            <span aria-hidden="true">‹</span>
            {level['parentTitle']}
          </button>
        )}
        <h2 className="nav-sheet-title" ref={headingRef} tabIndex={-1}>{level['title']}</h2>
        <div className="nav-sheet-body">
          {(children === undefined) ? level['groups'].map((group: Web_Navigation_SheetGroup): ReactElement => (
            <div className="nav-sheet-group" key={group['id']}>
              {(group['label'] === undefined) ? null : <h3 className="nav-sheet-group-title">{group['label']}</h3>}
              <div className="nav-sheet-rows">
                {group['rows'].map((row: Web_Navigation_SheetRow): ReactElement => {
                  const current: boolean = row['view'] !== undefined && row['views'].includes(activeView);

                  return (
                    <button
                      aria-current={(current) ? 'page' : undefined}
                      className="nav-sheet-row"
                      key={row['id']}
                      onClick={(): void => {
                        if (row['level'] !== undefined) {
                          onPush(row['level']);

                          return;
                        }

                        if (row['view'] === undefined) {
                          return;
                        }

                        onNavigate(row['view']);
                        onClose();
                      }}
                      type="button"
                    >
                      <Icon name={row['icon']} size={18} />
                      <span className="nav-sheet-row-copy">
                        <strong>{row['label']}</strong>
                        {(row['description'] === undefined) ? null : <small>{row['description']}</small>}
                      </span>
                      {(row['count'] === undefined) ? null : <span className="nav-sheet-row-count">{row['count']}</span>}
                      {(row['level'] === undefined) ? null : <Icon name="chevron" size={18} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )) : children}
        </div>
      </section>
    </>
  );
};
