import {
  useEffect,
  useRef,
} from 'react';

import { PHONE_NAV_SHEET_ID } from '@/web/navigation.ts';
import { Icon } from '@/web/primitives.tsx';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_NavSheet_NavSheet_ActiveView,
  Web_NavSheet_NavSheet_Children,
  Web_NavSheet_NavSheet_Current,
  Web_NavSheet_NavSheet_DialogRef,
  Web_NavSheet_NavSheet_FocusKey,
  Web_NavSheet_NavSheet_Heading,
  Web_NavSheet_NavSheet_HeadingRef,
  Web_NavSheet_NavSheet_Level,
  Web_NavSheet_NavSheet_OnBack,
  Web_NavSheet_NavSheet_OnClose,
  Web_NavSheet_NavSheet_OnNavigate,
  Web_NavSheet_NavSheet_OnPush,
  Web_NavSheet_NavSheet_Returns,
  Web_NavSheet_Props,
} from '@/types/web/nav-sheet.d.ts';

/**
 * Nav Sheet - Nav Sheet.
 *
 * Presents navigation rows or page content in a focus-managed phone sheet.
 * Nested More items reuse the same dialog while the pure stack owns its level.
 *
 * @param {Web_NavSheet_Props} props - Props.
 *
 * @returns {Web_NavSheet_NavSheet_Returns}
 *
 * @since 2.0.0
 */
export const NavSheet = (props: Web_NavSheet_Props): Web_NavSheet_NavSheet_Returns => {
  const activeView: Web_NavSheet_NavSheet_ActiveView = props['activeView'];
  const children: Web_NavSheet_NavSheet_Children = props['children'];
  const level: Web_NavSheet_NavSheet_Level = props['level'];
  const onBack: Web_NavSheet_NavSheet_OnBack = props['onBack'];
  const onClose: Web_NavSheet_NavSheet_OnClose = props['onClose'];
  const onNavigate: Web_NavSheet_NavSheet_OnNavigate = props['onNavigate'];
  const onPush: Web_NavSheet_NavSheet_OnPush = props['onPush'];
  const focusKey: Web_NavSheet_NavSheet_FocusKey = level['id'];
  const dialogRef: Web_NavSheet_NavSheet_DialogRef = useDialogFocus(true, focusKey);
  const headingRef: Web_NavSheet_NavSheet_HeadingRef = useRef<Web_NavSheet_NavSheet_Heading>(null);

  useEscapeKey(onClose, true);

  useEffect(() => {
    const heading: Web_NavSheet_NavSheet_Heading = headingRef.current;

    if (heading !== null) {
      heading.focus();
    }

    return;
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
          {(children === undefined) ? level['groups'].map((group) => (
            <div className="nav-sheet-group" key={group['id']}>
              {(group['label'] === undefined) ? null : <h3 className="nav-sheet-group-title">{group['label']}</h3>}
              <div className="nav-sheet-rows">
                {group['rows'].map((row) => {
                  const current: Web_NavSheet_NavSheet_Current = row['view'] !== undefined && row['views'].includes(activeView);

                  return (
                    <button
                      aria-current={(current === true) ? 'page' : undefined}
                      className="nav-sheet-row"
                      key={row['id']}
                      onClick={() => {
                        if (row['level'] !== undefined) {
                          onPush(row['level']);

                          return;
                        }

                        if (row['view'] === undefined) {
                          return;
                        }

                        onNavigate(row['view']);
                        onClose();

                        return;
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
