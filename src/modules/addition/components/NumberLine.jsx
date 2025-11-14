import PropTypes from 'prop-types';

const NumberLine = ({ max, a, b, showHint }) => {
  const total = Math.max(max, a + b);
  const ticks = Array.from({ length: total + 1 }, (_, i) => i);

  return (
    <div className="mt-6 px-2">
      <div className="relative h-12 border-t-2 border-gray-800">
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-gray-800" />
        <div className="flex justify-between items-start h-full">
          {ticks.map((i) => (
            <div key={i} className="flex flex-col items-center -mt-0.5">
              <div
                className={`w-0.5 h-3 ${
                  showHint && ((i <= a && i > 0)
                    ? 'bg-green-600'
                    : (i > a && i <= a + b)
                      ? 'bg-blue-600'
                      : 'bg-gray-800')
                }`}
              />
              <span className={`text-sm font-bold mt-1 ${i === a ? 'text-green-700' : i === a + b ? 'text-blue-700' : 'text-gray-900'}`}>
                {i}
              </span>
            </div>
          ))}
        </div>
      </div>
      {showHint && (
        <div className="text-center text-sm text-gray-700 mt-2">
          Count to <span className="font-bold text-green-700">{a}</span>, then jump <span className="font-bold text-blue-700">{b}</span> more → <span className="font-bold">{a + b}</span>
        </div>
      )}
    </div>
  );
};

NumberLine.propTypes = {
  max: PropTypes.number,
  a: PropTypes.number,
  b: PropTypes.number,
  showHint: PropTypes.bool,
};

NumberLine.defaultProps = {
  max: 18,
  a: 0,
  b: 0,
  showHint: false,
};

export default NumberLine;
