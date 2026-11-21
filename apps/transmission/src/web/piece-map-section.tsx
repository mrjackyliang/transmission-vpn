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

import type {
  Web_PieceMapSection_PieceMapSection_Availability,
  Web_PieceMapSection_PieceMapSection_Columns,
  Web_PieceMapSection_PieceMapSection_ColumnsState,
  Web_PieceMapSection_PieceMapSection_Count,
  Web_PieceMapSection_PieceMapSection_Grid,
  Web_PieceMapSection_PieceMapSection_GridRef,
  Web_PieceMapSection_PieceMapSection_Have,
  Web_PieceMapSection_PieceMapSection_Hovered,
  Web_PieceMapSection_PieceMapSection_HoveredSquare,
  Web_PieceMapSection_PieceMapSection_HoveredSquareState,
  Web_PieceMapSection_PieceMapSection_Measure,
  Web_PieceMapSection_PieceMapSection_Measure_Returns,
  Web_PieceMapSection_PieceMapSection_Observer,
  Web_PieceMapSection_PieceMapSection_Owned,
  Web_PieceMapSection_PieceMapSection_PeersConnected,
  Web_PieceMapSection_PieceMapSection_PerSquare,
  Web_PieceMapSection_PieceMapSection_PieceCount,
  Web_PieceMapSection_PieceMapSection_Pieces,
  Web_PieceMapSection_PieceMapSection_PieceSize,
  Web_PieceMapSection_PieceMapSection_PieceSizeLabel,
  Web_PieceMapSection_PieceMapSection_Props,
  Web_PieceMapSection_PieceMapSection_Returns,
  Web_PieceMapSection_PieceMapSection_Section,
  Web_PieceMapSection_PieceMapSection_SectionRef,
  Web_PieceMapSection_PieceMapSection_SetColumns,
  Web_PieceMapSection_PieceMapSection_SetHoveredSquare,
  Web_PieceMapSection_PieceMapSection_SetTipPosition,
  Web_PieceMapSection_PieceMapSection_Square,
  Web_PieceMapSection_PieceMapSection_Squares,
  Web_PieceMapSection_PieceMapSection_Target,
  Web_PieceMapSection_PieceMapSection_Tip,
  Web_PieceMapSection_PieceMapSection_TipElement,
  Web_PieceMapSection_PieceMapSection_TipPosition,
  Web_PieceMapSection_PieceMapSection_TipPositionState,
  Web_PieceMapSection_PieceMapSection_TipRef,
  Web_PieceMapSection_SquareGap,
  Web_PieceMapSection_SquareSize,
} from '@/types/web/piece-map-section.d.ts';

/**
 * Piece Map Section - Square Size.
 *
 * Matches --piece-size in detail.css, since the column count is worked out from it.
 * Changing one without the other leaves the map's last column half empty.
 *
 * @since 2.0.0
 */
const squareSize: Web_PieceMapSection_SquareSize = 9;

/**
 * Piece Map Section - Square Gap.
 *
 * Matches --piece-gap in detail.css, since the column count is worked out from it.
 * Changing one without the other leaves the map's last column half empty.
 *
 * @since 2.0.0
 */
const squareGap: Web_PieceMapSection_SquareGap = 2;

/**
 * Piece Map Section - Piece Map Section.
 *
 * Shows which pieces of a torrent are here as a grid of squares, greener the more of a
 * square is downloaded, with an outline where no connected peer has a missing piece.
 *
 * @param {Web_PieceMapSection_PieceMapSection_Props} props - Props.
 *
 * @returns {Web_PieceMapSection_PieceMapSection_Returns}
 *
 * @since 2.0.0
 */
export const PieceMapSection = (props: Web_PieceMapSection_PieceMapSection_Props): Web_PieceMapSection_PieceMapSection_Returns => {
  const availability: Web_PieceMapSection_PieceMapSection_Availability = props['availability'];
  const peersConnected: Web_PieceMapSection_PieceMapSection_PeersConnected = props['peersConnected'];
  const pieceCount: Web_PieceMapSection_PieceMapSection_PieceCount = props['pieceCount'];
  const pieceSize: Web_PieceMapSection_PieceMapSection_PieceSize = props['pieceSize'];
  const pieces: Web_PieceMapSection_PieceMapSection_Pieces = props['pieces'];
  const sectionRef: Web_PieceMapSection_PieceMapSection_SectionRef = useRef<Web_PieceMapSection_PieceMapSection_Section>(null);
  const gridRef: Web_PieceMapSection_PieceMapSection_GridRef = useRef<Web_PieceMapSection_PieceMapSection_Grid>(null);
  const tipRef: Web_PieceMapSection_PieceMapSection_TipRef = useRef<Web_PieceMapSection_PieceMapSection_TipElement>(null);
  const columnsState: Web_PieceMapSection_PieceMapSection_ColumnsState = useState<Web_PieceMapSection_PieceMapSection_Columns>(59);
  const columns: Web_PieceMapSection_PieceMapSection_Columns = columnsState[0];
  const setColumns: Web_PieceMapSection_PieceMapSection_SetColumns = columnsState[1];
  const hoveredSquareState: Web_PieceMapSection_PieceMapSection_HoveredSquareState = useState<Web_PieceMapSection_PieceMapSection_HoveredSquare>(null);
  const hoveredSquare: Web_PieceMapSection_PieceMapSection_HoveredSquare = hoveredSquareState[0];
  const setHoveredSquare: Web_PieceMapSection_PieceMapSection_SetHoveredSquare = hoveredSquareState[1];
  const tipPositionState: Web_PieceMapSection_PieceMapSection_TipPositionState = useState<Web_PieceMapSection_PieceMapSection_TipPosition>(null);
  const tipPosition: Web_PieceMapSection_PieceMapSection_TipPosition = tipPositionState[0];
  const setTipPosition: Web_PieceMapSection_PieceMapSection_SetTipPosition = tipPositionState[1];
  const count: Web_PieceMapSection_PieceMapSection_Count = pieceCount ?? 0;
  const have: Web_PieceMapSection_PieceMapSection_Have = useMemo(() => decodePieces(pieces ?? '', count), [
    count,
    pieces,
  ]);
  const perSquare: Web_PieceMapSection_PieceMapSection_PerSquare = piecesPerSquare(count, columns);

  // With nobody connected, every missing piece reads zero peers, which says nothing about it.
  const squares: Web_PieceMapSection_PieceMapSection_Squares = useMemo(() => summarizeSquares(
    have,
    (peersConnected > 0) ? availability : undefined,
    perSquare,
  ), [
    availability,
    have,
    peersConnected,
    perSquare,
  ]);

  useLayoutEffect(() => {
    const grid: Web_PieceMapSection_PieceMapSection_Grid = gridRef.current;

    if (grid === null) {
      return undefined;
    }

    /**
     * Piece Map Section - Measure.
     *
     * Fits as many squares per row as the panel's width allows.
     * The map then groups pieces so it stays within ten rows.
     *
     * @returns {Web_PieceMapSection_PieceMapSection_Measure_Returns}
     *
     * @since 2.0.0
     */
    const measure: Web_PieceMapSection_PieceMapSection_Measure = (): Web_PieceMapSection_PieceMapSection_Measure_Returns => {
      setColumns(Math.max(1, Math.floor((grid.clientWidth + squareGap) / (squareSize + squareGap))));

      return;
    };
    const observer: Web_PieceMapSection_PieceMapSection_Observer = new ResizeObserver(measure);

    measure();

    observer.observe(grid);

    return () => {
      observer.disconnect();

      return;
    };
  }, [count]);

  useLayoutEffect(() => {
    const grid: Web_PieceMapSection_PieceMapSection_Grid = gridRef.current;
    let square: Web_PieceMapSection_PieceMapSection_Square = null;

    if (hoveredSquare !== null) {
      square = (grid !== null) ? grid.querySelector<HTMLElement>(`[data-square="${String(hoveredSquare)}"]`) : undefined;
    }

    const tipElement: Web_PieceMapSection_PieceMapSection_TipElement = tipRef.current;
    const section: Web_PieceMapSection_PieceMapSection_Section = sectionRef.current;

    if (
      square === null
      || square === undefined
      || tipElement === null
      || section === null
    ) {
      setTipPosition(null);

      return;
    }

    // Center the tooltip over the square, kept inside the section, just above the square's row.
    setTipPosition({
      left: Math.min(Math.max(0, square.offsetLeft + (squareSize / 2) - (tipElement.offsetWidth / 2)), section.clientWidth - tipElement.offsetWidth),
      top: square.offsetTop - tipElement.offsetHeight - 8,
    });

    return;
  }, [hoveredSquare]);

  if (count === 0 || pieces === undefined) {
    return (
      <section className="piece-map">
        <div className="piece-map-head"><h3>Pieces</h3></div>
        <p className="piece-empty">{'Pieces show once the torrent\'s file list arrives from its peers.'}</p>
      </section>
    );
  }

  const owned: Web_PieceMapSection_PieceMapSection_Owned = have.filter(Boolean).length;
  const hovered: Web_PieceMapSection_PieceMapSection_Hovered = (hoveredSquare === null) ? undefined : squares[hoveredSquare];
  const tip: Web_PieceMapSection_PieceMapSection_Tip = (hovered === undefined) ? null : describeSquare(hovered);
  const pieceSizeLabel: Web_PieceMapSection_PieceMapSection_PieceSizeLabel = (pieceSize === undefined) ? '' : ` · ${formatBytes(pieceSize)} each`;

  return (
    <section className="piece-map" ref={sectionRef}>
      <div className="piece-map-head">
        <h3>Pieces</h3>
        <span>{`${owned.toLocaleString()} of ${count.toLocaleString()}${pieceSizeLabel}`}</span>
      </div>
      <div
        aria-label={`${owned.toLocaleString()} of ${count.toLocaleString()} pieces downloaded`}
        className="piece-grid"
        onPointerLeave={() => setHoveredSquare(null)}
        onPointerMove={(event) => {
          const target: Web_PieceMapSection_PieceMapSection_Target = event.target;

          if (target instanceof HTMLElement && target.dataset['square'] !== undefined) {
            setHoveredSquare(Number(target.dataset['square']));
          }

          return;
        }}
        ref={gridRef}
        role="img"
      >
        {squares.map((square, index) => (
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
          {(squares.some((square) => square['unavailable'] > 0) === true) ? (
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
