import PropTypes from 'prop-types';

const CountableObjects = ({ digit, type, theme }) => {
  const renderThemedObject = (index) => {
    if (!theme || !theme.icons || theme.icons.length === 0) return null;
    const icon = theme.icons[index % theme.icons.length];
    const jitterX = (Math.sin(index * 2.5) * 4);
    const jitterY = (Math.cos(index * 3.2) * 4);
    const rotation = (Math.sin(index * 1.7) * 15);

    return (
      <div
        key={index}
        style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`, fontSize: '2.5rem' }}
      >
        {icon}
      </div>
    );
  };

  const renderObject = (index) => {
    const jitterX = (Math.sin(index * 2.5) * 4);
    const jitterY = (Math.cos(index * 3.2) * 4);
    const rotation = (Math.sin(index * 1.7) * 15);

    switch (type) {
      case 0:
        return (
          <svg key={index} width="40" height="40" viewBox="0 0 40 40" style={{ transform: `translate(${jitterX}px, ${jitterY}px)` }}>
            <circle cx="20" cy="20" r="16" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4" />
            <text x="20" y="26" textAnchor="middle" fill="#94a3b8" fontSize="16" fontWeight="bold">0</text>
          </svg>
        );
      case 1:
        return (
          <svg
            key={index}
            width="28"
            height="50"
            viewBox="0 0 28 50"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)` }}
          >
            <defs>
              <linearGradient id={`stick-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="50%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
            <rect x="8" y="2" width="12" height="46" rx="6" fill={`url(#stick-grad-${index})`} />
            <ellipse cx="10" cy="8" rx="2" ry="8" fill="#d97706" opacity="0.3" />
          </svg>
        );
      case 2:
        return (
          <svg
            key={index}
            width="38"
            height="32"
            viewBox="0 0 38 32"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)` }}
          >
            <defs>
              <radialGradient id={`pebble-grad-${index}`}>
                <stop offset="0%" stopColor="#d1d5db" />
                <stop offset="70%" stopColor="#9ca3af" />
                <stop offset="100%" stopColor="#6b7280" />
              </radialGradient>
            </defs>
            <ellipse cx="19" cy="16" rx="17" ry="14" fill={`url(#pebble-grad-${index})`} />
            <ellipse cx="12" cy="10" rx="6" ry="4" fill="white" opacity="0.4" />
          </svg>
        );
      case 3:
        return (
          <svg
            key={index}
            width="40"
            height="36"
            viewBox="0 0 40 36"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)` }}
          >
            <defs>
              <linearGradient id={`leaf-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#86efac" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
            </defs>
            <path d="M20,2 Q35,18 20,34 Q5,18 20,2 Z" fill={`url(#leaf-grad-${index})`} />
            <path d="M20,2 L20,34" stroke="#15803d" strokeWidth="2" fill="none" />
            <path d="M20,10 Q28,14 20,20" stroke="#15803d" strokeWidth="1" fill="none" opacity="0.5" />
            <path d="M20,16 Q12,20 20,26" stroke="#15803d" strokeWidth="1" fill="none" opacity="0.5" />
          </svg>
        );
      case 4:
        return (
          <svg key={index} width="36" height="36" viewBox="0 0 36 36" style={{ transform: `translate(${jitterX}px, ${jitterY}px)` }}>
            <defs>
              <radialGradient id={`marble-grad-${index}`}>
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1e40af" />
              </radialGradient>
            </defs>
            <circle cx="18" cy="18" r="16" fill={`url(#marble-grad-${index})`} />
            <circle cx="13" cy="12" r="5" fill="white" opacity="0.7" />
            <circle cx="11" cy="10" r="3" fill="white" opacity="0.9" />
            <circle cx="22" cy="24" r="3" fill="#1e3a8a" opacity="0.3" />
          </svg>
        );
      case 5:
        return (
          <svg
            key={index}
            width="36"
            height="36"
            viewBox="0 0 36 36"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)` }}
          >
            <defs>
              <linearGradient id={`button-grad-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="16" fill={`url(#button-grad-${index})`} stroke="#d97706" strokeWidth="2" />
            <circle cx="12" cy="13" r="2.5" fill="#92400e" />
            <circle cx="24" cy="13" r="2.5" fill="#92400e" />
            <circle cx="12" cy="23" r="2.5" fill="#92400e" />
            <circle cx="24" cy="23" r="2.5" fill="#92400e" />
          </svg>
        );
      case 6:
        return (
          <svg
            key={index}
            width="42"
            height="38"
            viewBox="0 0 42 38"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)` }}
          >
            <defs>
              <radialGradient id={`rock-grad-${index}`}>
                <stop offset="0%" stopColor="#9ca3af" />
                <stop offset="100%" stopColor="#4b5563" />
              </radialGradient>
            </defs>
            <path d="M8,20 L15,8 L25,6 L35,12 L38,22 L32,32 L20,35 L10,30 Z" fill={`url(#rock-grad-${index})`} />
            <ellipse cx="16" cy="14" rx="6" ry="4" fill="white" opacity="0.2" />
            <path d="M12,18 L18,16 L14,22" stroke="#374151" strokeWidth="1.5" fill="none" opacity="0.4" />
          </svg>
        );
      case 7:
        return (
          <svg
            key={index}
            width="32"
            height="46"
            viewBox="0 0 32 46"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)` }}
          >
            <defs>
              <radialGradient id={`acorn-cap-${index}`}>
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>
              <radialGradient id={`acorn-body-${index}`}>
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </radialGradient>
            </defs>
            <ellipse cx="16" cy="8" rx="14" ry="8" fill={`url(#acorn-cap-${index})`} />
            <path d="M4,8 Q16,4 28,8" stroke="#78350f" strokeWidth="1.5" fill="none" />
            <path d="M6,11 Q16,7 26,11" stroke="#78350f" strokeWidth="1.5" fill="none" />
            <ellipse cx="16" cy="28" rx="11" ry="16" fill={`url(#acorn-body-${index})`} />
            <ellipse cx="12" cy="20" rx="3" ry="5" fill="#fef3c7" opacity="0.5" />
            <circle cx="16" cy="38" r="2" fill="#78350f" />
          </svg>
        );
      case 8:
        return (
          <svg
            key={index}
            width="38"
            height="38"
            viewBox="0 0 38 38"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)` }}
          >
            <defs>
              <linearGradient id={`shell-grad-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#fed7aa" />
              </linearGradient>
            </defs>
            <path d="M19,4 L6,32 L19,28 L32,32 Z" fill={`url(#shell-grad-${index})`} stroke="#fdba74" strokeWidth="2" />
            {[8, 14, 20, 26].map((y, i) => (
              <line key={i} x1="19" y1={y} x2="19" y2={y + 4} stroke="#fed7aa" strokeWidth="1.5" />
            ))}
            <path d="M19,4 L10,28" stroke="#fdba74" strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M19,4 L28,28" stroke="#fdba74" strokeWidth="1.5" fill="none" opacity="0.6" />
          </svg>
        );
      case 9:
        return (
          <svg
            key={index}
            width="34"
            height="50"
            viewBox="0 0 34 50"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)` }}
          >
            <defs>
              <linearGradient id={`pine-grad-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
            <ellipse cx="17" cy="25" rx="13" ry="22" fill={`url(#pine-grad-${index})`} />
            {[8, 14, 20, 26, 32, 38].map((y, i) => (
              <g key={i}>
                <ellipse cx="10" cy={y} rx="4" ry="3" fill="#a16207" opacity="0.8" />
                <ellipse cx="17" cy={y + 2} rx="4" ry="3" fill="#a16207" opacity="0.8" />
                <ellipse cx="24" cy={y} rx="4" ry="3" fill="#a16207" opacity="0.8" />
              </g>
            ))}
            <ellipse cx="17" cy="6" rx="3" ry="4" fill="#92400e" />
          </svg>
        );
      default:
        return null;
    }
  };

  const cols = digit <= 3 ? digit : Math.ceil(Math.sqrt(digit));
  const rows = digit === 0 ? 0 : Math.ceil(digit / (cols || 1));
  const itemsToRender = digit;

  return (
    <div className="flex items-center justify-center min-h-[130px] p-2">
      <div
        className="grid gap-3 items-center justify-items-center"
        style={{
          gridTemplateColumns: `repeat(${cols || 1}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: itemsToRender }, (_, i) => (theme ? renderThemedObject(i) : renderObject(i)))}
      </div>
    </div>
  );
};

CountableObjects.propTypes = {
  digit: PropTypes.number.isRequired,
  type: PropTypes.number.isRequired,
  theme: PropTypes.shape({
    icons: PropTypes.arrayOf(PropTypes.node),
  }),
};

CountableObjects.defaultProps = {
  theme: null,
};

export default CountableObjects;
