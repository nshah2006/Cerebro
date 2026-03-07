import { Chess, Square } from 'chess.js';
import { useState } from 'react';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: Square, to: Square) => void;
  currentPlayer: 'white' | 'black';
}

export function ChessBoard({ game, onMove, currentPlayer }: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);

  const board = game.board();

  const handleSquareClick = (square: Square, row: number, col: number) => {
    const piece = board[row][col];

    if (selectedSquare) {
      // Try to make a move
      if (possibleMoves.includes(square)) {
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (piece && piece.color === currentPlayer[0]) {
        // Select a different piece
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setPossibleMoves(moves.map(m => m.to as Square));
      } else {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    } else if (piece && piece.color === currentPlayer[0]) {
      // Select a piece
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setPossibleMoves(moves.map(m => m.to as Square));
    }
  };

  const getSquareName = (row: number, col: number): Square => {
    const file = String.fromCharCode(97 + col); // a-h
    const rank = 8 - row; // 8-1
    return `${file}${rank}` as Square;
  };

  const isLightSquare = (row: number, col: number) => (row + col) % 2 === 0;

  return (
    <div className="inline-block bg-slate-800 p-4 rounded-lg shadow-2xl">
      <div className="grid grid-cols-8 gap-0 border-2 border-slate-700">
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const square = getSquareName(rowIndex, colIndex);
            const isLight = isLightSquare(rowIndex, colIndex);
            const isSelected = selectedSquare === square;
            const isPossibleMove = possibleMoves.includes(square);

            let bgColor = isLight ? 'bg-amber-100' : 'bg-amber-700';
            if (isSelected) {
              bgColor = 'bg-yellow-400';
            } else if (isPossibleMove) {
              bgColor = isLight ? 'bg-green-200' : 'bg-green-600';
            }

            // e.g. "wp", "bp", "wn", "bn" — matches your filename convention
            const pieceKey = piece ? `${piece.color}${piece.type}` : null;

            return (
              <button
                key={square}
                onClick={() => handleSquareClick(square, rowIndex, colIndex)}
                className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center transition-all hover:opacity-80 ${bgColor} ${
                  isPossibleMove ? 'cursor-pointer' : ''
                }`}
              >
                {pieceKey && (
                  <img
                    src={`/public-pieces/${pieceKey}.svg`}
                    alt={pieceKey}
                    className="w-10 h-10 sm:w-12 sm:h-12 select-none pointer-events-none"
                    draggable={false}
                  />
                )}
                {isPossibleMove && !piece && (
                  <div className="w-4 h-4 rounded-full bg-slate-900 opacity-30"></div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Coordinates */}
      <div className="flex justify-around mt-2 text-slate-400 text-sm">
        {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(file => (
          <div key={file} className="w-16 sm:w-20 text-center">{file}</div>
        ))}
      </div>
    </div>
  );
}
