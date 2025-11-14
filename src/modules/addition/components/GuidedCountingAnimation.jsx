import PropTypes from 'prop-types';

const GuidedCountingAnimation = ({ card, step, complete }) => {
  if (!card) return null;
  const total = card.a + card.b;
  const numbers = Array.from({ length: total + 1 }, (_, i) => i);
  const accuracyMessage = complete
    ? `We landed on ${total}! Type it in the box.`
    : `Let's count from ${card.a} and add ${card.b} more together.`;

  return (
    <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
      <div className="text-sm font-semibold text-blue-800 text-center mb-3">{accuracyMessage}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {numbers.map((value) => {
          const isStart = value === card.a;
          const isActive = value <= step;
          return (
            <div
              key={value}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                isStart
                  ? 'bg-green-200 text-green-800 border-2 border-green-500'
                  : isActive
                    ? 'bg-blue-500 text-white border-2 border-blue-600'
                    : 'bg-white text-gray-500 border-2 border-blue-200'
              }`}
            >
              {value}
            </div>
          );
        })}
      </div>
    </div>
  );
};

GuidedCountingAnimation.propTypes = {
  card: PropTypes.shape({
    a: PropTypes.number.isRequired,
    b: PropTypes.number.isRequired,
  }),
  step: PropTypes.number.isRequired,
  complete: PropTypes.bool,
};

GuidedCountingAnimation.defaultProps = {
  card: null,
  complete: false,
};

export default GuidedCountingAnimation;
