import { useMemo } from 'react';

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const ConfettiBurst = ({ pieces = 80 }) => {
  const confettiPieces = useMemo(
    () => Array.from({ length: pieces }).map((_, index) => ({
      id: index,
      left: randomBetween(0, 100),
      delay: randomBetween(0, 0.35),
      duration: randomBetween(2.5, 3.75),
      size: randomBetween(6, 11),
      rotation: randomBetween(-25, 25),
      hue: Math.floor(randomBetween(0, 360)),
    })),
    [pieces],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {confettiPieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute block rounded-sm opacity-0 animate-confetti-burst"
          style={{
            left: `${piece.left}%`,
            top: '-5%',
            width: `${piece.size}px`,
            height: `${piece.size * 0.6}px`,
            backgroundColor: `hsl(${piece.hue} 90% 65%)`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
};

export default ConfettiBurst;
