import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  decodePieces,
  describeSquare,
  piecesPerSquare,
  summarizeSquares,
} from '@/web/piece-map.ts';
import { formatBytes } from '@/web/torrent-format.ts';

import type { ReactElement } from 'react';

import type {
  Web_PieceMap_Props,
  Web_PieceMap_Square,
  Web_PieceMap_TipPosition,
} from '@/types/web/piece-map.d.ts';

/**
 * Piece Map Section - Square size.
 *
 * Matches --piece-size in detail.css, since the column count is worked out from it.
 * Changing one without the other leaves the map's last column half empty.
 *
 * @since UNRELEASED
 */
const squareSize: number = 9;

/**
 * Piece Map Section - Square gap.
 *
 * Matches --piece-gap in detail.css, since the column count is worked out from it.
 * Changing one without the other leaves the map's last column half empty.
 *
 * @since UNRELEASED
 */
const squareGap: number = 2;

/**
 * Piece Map Section.
 *
 * Shows which pieces of a torrent are here as a grid of squares, greener the more of a
 * square is downloaded, with an outline where no connected peer has a missing piece.
 *
 * @since UNRELEASED
 */
export const PieceMapSection = ({
  availability,
  peersConnected,
  pieceCount,
  pieceSize,
  pieces,
}: Web_PieceMap_Props): ReactElement => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [
    columns,
    setColumns,
  ] = useState<number>(59);
  const [
    hoveredSquare,
    setHoveredSquare,
  ] = useState<number | null>(null);
  const [
    tipPosition,
    setTipPosition,
  ] = useState<Web_PieceMap_TipPosition | null>(null);
  const count: number = pieceCount ?? 0;
  const have: boolean[] = useMemo((): boolean[] => decodePieces(pieces ?? '', count), [
    count,
    pieces,
  ]);
  const perSquare: number = piecesPerSquare(count, columns);

  // With nobody connected, every missing piece reads zero peers, which says nothing about it.
  const squares: Web_PieceMap_Square[] = useMemo((): Web_PieceMap_Square[] => summarizeSquares(
    have,
    (peersConnected > 0) ? availability : undefined,
    perSquare,
  ), [
    availability,
    have,
    peersConnected,
    perSquare,
  ]);

  useLayoutEffect((): (() => void) | undefined => {
    const grid: HTMLDivElement | null = gridRef.current;

    if (grid === null) {
      return undefined;
    }

    /**
     * Piece Map Section - Measure.
     *
     * Fits as many squares per row as the panel's width allows.
     * The map then groups pieces so it stays within ten rows.
     *
     * @since UNRELEASED
     */
    const measure = (): void => {
      setColumns(Math.max(1, Math.floor((grid.clientWidth + squareGap) / (squareSize + squareGap))));
    };
    const observer: ResizeObserver = new ResizeObserver(measure);

    measure();
    observer.observe(grid);

    return (): void => {
      observer.disconnect();
    };
  }, [count]);

  useLayoutEffect((): void => {
    const square: HTMLElement | null | undefined = (hoveredSquare === null) ? null : gridRef.current?.querySelector<HTMLElement>(`[data-square="${String(hoveredSquare)}"]`);
    const tip: HTMLDivElement | null = tipRef.current;
    const section: HTMLElement | null = sectionRef.current;

    if (square === null || square === undefined || tip === null || section === null) {
      setTipPosition(null);

      return;
    }

    // Center the tooltip over the square, kept inside the section, just above the square's row.
    setTipPosition({
      left: Math.min(Math.max(0, square.offsetLeft + (squareSize / 2) - (tip.offsetWidth / 2)), section.clientWidth - tip.offsetWidth),
      top: square.offsetTop - tip.offsetHeight - 8,
    });
  }, [hoveredSquare]);

  if (count === 0 || pieces === undefined) {
    return (
      <section className="piece-map">
        <div className="piece-map-head"><h3>Pieces</h3></div>
        <p className="piece-empty">{'Pieces show once the torrent\'s file list arrives from its peers.'}</p>
      </section>
    );
  }

  const owned: number = have.filter(Boolean).length;
  const hovered: Web_PieceMap_Square | undefined = (hoveredSquare === null) ? undefined : squares[hoveredSquare];
  const tip: [string, string] | null = (hovered === undefined) ? null : describeSquare(hovered);

  return (
    <section className="piece-map" ref={sectionRef}>
      <div className="piece-map-head">
        <h3>Pieces</h3>
        <span>{`${owned.toLocaleString()} of ${count.toLocaleString()}${(pieceSize === undefined) ? '' : ` · ${formatBytes(pieceSize)} each`}`}</span>
      </div>
      <div
        aria-label={`${owned.toLocaleString()} of ${count.toLocaleString()} pieces downloaded`}
        className="piece-grid"
        onPointerLeave={(): void => setHoveredSquare(null)}
        onPointerMove={(event): void => {
          const target: EventTarget = event.target;

          if (target instanceof HTMLElement && target.dataset['square'] !== undefined) {
            setHoveredSquare(Number(target.dataset['square']));
          }
        }}
        ref={gridRef}
        role="img"
      >
        {squares.map((square: Web_PieceMap_Square, index: number): ReactElement => (
          <span
            className="piece"
            data-hover={(index === hoveredSquare) ? '' : undefined}
            data-level={square['level']}
            data-square={index}
            data-unavailable={(square['unavailable'] > 0) ? '' : undefined}
            key={square['first']}
          />
        ))}
      </div>
      <div className="piece-legend">
        <span>{(perSquare === 1) ? '1 square = 1 piece' : `1 square = ${perSquare.toLocaleString()} pieces`}</span>
        <span className="piece-key">
          <span className="piece-scale">
            <span>Missing</span>
            <span className="piece" data-level="0" />
            <span className="piece" data-level="1" />
            <span className="piece" data-level="2" />
            <span className="piece" data-level="3" />
            <span className="piece" data-level="4" />
            <span>Have</span>
          </span>
          {(squares.some((square: Web_PieceMap_Square): boolean => square['unavailable'] > 0)) ? (
            <span className="piece-scale">
              <span className="piece" data-unavailable="" />
              <span>No peer has it</span>
            </span>
          ) : null}
        </span>
      </div>
      {(tip === null) ? null : (
        <div
          className="piece-tooltip"
          ref={tipRef}
          role="tooltip"
          style={(tipPosition === null) ? { visibility: 'hidden' } : {
            left: tipPosition['left'],
            top: tipPosition['top'],
          }}
        >
          <strong>{tip[0]}</strong>
          {tip[1]}
        </div>
      )}
    </section>
  );
};
