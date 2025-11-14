import PropTypes from 'prop-types';
import { X, Brain, Target, Zap } from 'lucide-react';
import { computeKnowledgeInsights } from '../state/insights';
import { dayKey } from '../state/gameState';

function ParentDashboard({ gameState, aiRuntime, onClose }) {
  const stats = gameState.statistics;
  const mastery = gameState.masteryTracking;
  const knowledgeInsights = computeKnowledgeInsights(gameState);
  const { knowledgeGrade, ageGrade, delta } = knowledgeInsights;

  const totalProblems = Object.values(stats.problemHistory).length;
  const correctProblems = Object.values(stats.problemHistory).filter(p => p.correct).length;
  const totalAttempts = stats.totalProblemsAttempted || 0;
  const totalCorrect = stats.totalCorrect || 0;
  const overallAccuracy = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : '0.0';

  const avgTime = totalAttempts > 0 ? stats.averageTimePerProblem.toFixed(1) : 0;
  const todayKey = dayKey();
  const todayTotals = stats.dailyTotals?.[todayKey] || { attempts: 0, correct: 0, seconds: 0 };
  const todayMinutes = (todayTotals.seconds / 60).toFixed(1);
  const wastePercentage = (stats.wastePercentage || 0).toFixed(1);

  // Calculate growth rate using answersTimeline (last 7 days) vs baseline 20
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const attempts7d = (stats.answersTimeline || []).filter(e => e.ts >= weekAgo).length;
  const growthRate = totalAttempts > 0 ? ((attempts7d / 20) || 0).toFixed(1) : '0.0';

  const baselineDaily = 20 / 7;
  const last7Days = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = dayKey(date.getTime());
    const attempts = stats.dailyTotals?.[key]?.attempts || 0;
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      attempts,
    };
  });
  const maxDailyAttempts = Math.max(
    baselineDaily,
    ...last7Days.map(day => day.attempts)
  );

  // Coverage bar: percent of 100 pairs with >=1 correct
  const coverageSet = new Set(
    Object.entries(stats.problemHistory)
      .filter(([, v]) => v.correct > 0)
      .map(([k]) => k)
  );
  const coveragePct = ((coverageSet.size / 100) * 100).toFixed(0);

  const deltaToneClasses = {
    ahead: 'border-green-300 bg-green-50 text-green-700',
    balanced: 'border-blue-300 bg-blue-50 text-blue-700',
    support: 'border-orange-300 bg-orange-50 text-orange-700',
  };
  const deltaClass = deltaToneClasses[delta.tone] || deltaToneClasses.balanced;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-3xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold mb-2">Tablou pentru părinți</h2>
              <p className="text-blue-100">Analiză detaliată a progresului</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                  aiRuntime?.aiEnabled
                    ? 'bg-emerald-400/20 border-emerald-200/40 text-emerald-100'
                    : 'bg-white/10 border-white/30 text-white'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${aiRuntime?.aiEnabled ? 'bg-emerald-200' : 'bg-red-200'}`}
                  aria-hidden="true"
                />
                {aiRuntime?.aiEnabled ? 'AI activ' : 'AI dezactivat'}
              </span>
              <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border-2 border-green-200">
              <div className="text-green-600 text-sm font-medium mb-1">Acuratețe generală</div>
              <div className="text-3xl font-bold text-green-700">{overallAccuracy}%</div>
              <div className="text-xs text-green-600 mt-1">Țintă: 70-95%</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border-2 border-blue-200">
              <div className="text-blue-600 text-sm font-medium mb-1">Timp mediu / problemă</div>
              <div className="text-3xl font-bold text-blue-700">{avgTime}s</div>
              <div className="text-xs text-blue-600 mt-1">Țintă: 30-60s</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border-2 border-purple-200">
              <div className="text-purple-600 text-sm font-medium mb-1">Minute astăzi</div>
              <div className="text-3xl font-bold text-purple-700">{todayMinutes}</div>
              <div className="text-xs text-purple-600 mt-1">Țintă: &lt;20 min</div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border-2 border-orange-200">
              <div className="text-orange-600 text-sm font-medium mb-1">Ritmul de creștere</div>
              <div className="text-3xl font-bold text-orange-700">{growthRate}x</div>
              <div className="text-xs text-orange-600 mt-1">Comparativ cu media copiilor</div>
            </div>
          </div>

          {/* Knowledge vs Age Grade */}
          <div className="bg-gradient-to-br from-sky-50 to-indigo-50 p-6 rounded-xl border-2 border-sky-200">
            <h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
              <Brain className="text-indigo-500" />
              Nivel de cunoștințe vs nivelul așteptat pentru vârstă
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4">
                <div className="text-xs uppercase text-indigo-500 font-semibold tracking-wide">Nivel de cunoștințe</div>
                <div className="text-2xl font-bold text-gray-800 mt-1">{knowledgeGrade.label}</div>
                <p className="text-sm text-gray-600 mt-2">{knowledgeGrade.detail}</p>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progres</span>
                    <span>{knowledgeGrade.progressPercent}% din harta numerelor 0-9</span>
                  </div>
                  <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${knowledgeGrade.progressPercent}%` }}
                    />
                  </div>
                  <div className="text-xs text-indigo-600 mt-2">
                    Cel mai bine stăpânit număr: {knowledgeGrade.highestStrong >= 0 ? knowledgeGrade.highestStrong : 'în curs'} · Următorul focus: {knowledgeGrade.nextNumber}
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-sky-200 rounded-2xl p-4">
                <div className="text-xs uppercase text-sky-500 font-semibold tracking-wide">Așteptarea pentru vârstă</div>
                <div className="text-2xl font-bold text-gray-800 mt-1">{ageGrade.label}</div>
                <p className="text-sm text-gray-600 mt-2">{ageGrade.detail}</p>
                <div className="mt-4 text-xs text-sky-600">
                  Vârsta copilului: {typeof gameState.studentInfo?.age === 'number' ? `${gameState.studentInfo.age.toFixed(1)} ani` : 'Necompletată'}
                </div>
              </div>

              <div className={`rounded-2xl p-4 border-2 ${deltaClass}`}>
                <div className="text-xs uppercase font-semibold tracking-wide">Instantaneu de aliniere</div>
                <div className="text-xl font-bold mt-1">{delta.label}</div>
                <p className="text-sm mt-2">{delta.message}</p>
                <div className="mt-4 text-xs font-semibold">
                  {aiRuntime?.aiEnabled
                    ? `AI sugerează să insiști pe +${knowledgeGrade.nextNumber} pentru a menține ritmul de creștere.`
                    : 'Analiza locală recomandă să continui ritmul constant cât timp funcțiile AI sunt în pauză.'}
                </div>
              </div>
            </div>
          </div>

          {/* Coverage Bar */}
          <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
            <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Acoperire (0..9)×(0..9) cu ≥1 răspuns corect</span>
              <span>{coveragePct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="h-3 rounded-full bg-indigo-500" style={{ width: `${coveragePct}%` }} />
            </div>
          </div>

          {/* Growth Chart */}
          <div className="bg-white p-6 rounded-xl border-2 border-orange-200">
            <h3 className="text-xl font-bold text-orange-600 mb-4 flex items-center gap-2">
              <Target className="text-orange-500" />
              Evoluție vs ritm obișnuit
            </h3>
            <div className="h-40 flex items-end gap-3">
              {last7Days.map((day, index) => {
                const actualHeight = maxDailyAttempts > 0 ? (day.attempts / maxDailyAttempts) * 100 : 0;
                const baselineHeight = maxDailyAttempts > 0 ? (baselineDaily / maxDailyAttempts) * 100 : 0;
                return (
                  <div key={`${day.label}-${index}`} className="flex-1 flex flex-col items-center">
                    <div className="relative w-full flex-1 bg-orange-100 rounded-t-xl overflow-hidden">
                      <div
                        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orange-500 to-orange-400"
                        style={{ height: `${actualHeight}%` }}
                      />
                      <div
                        className="absolute inset-x-0 border-t-2 border-dashed border-orange-700"
                        style={{ bottom: `${baselineHeight}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs font-semibold text-orange-700">{day.label}</div>
                    <div className="text-[10px] text-orange-500">{day.attempts} încercări</div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-orange-600 mt-3 text-center">
              Linia întreruptă marchează un ritm zilnic tipic (~{baselineDaily.toFixed(1)} încercări).
            </p>
          </div>

          {/* Learning Efficiency */}
          <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Zap className="text-yellow-500" />
              Eficiența învățării
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Indice de concentrare</span>
                  <span className="text-sm font-bold text-gray-900">{(100 - parseFloat(wastePercentage)).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${parseFloat(wastePercentage) < 20 ? 'bg-green-500' : parseFloat(wastePercentage) < 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{width: `${100 - parseFloat(wastePercentage)}%`}}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Risipă: {wastePercentage}% (Țintă: &lt;20%)</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Probleme rezolvate</div>
                  <div className="text-2xl font-bold text-gray-800">{totalProblems}</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Răspunsuri corecte</div>
                  <div className="text-2xl font-bold text-green-600">{correctProblems}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mastery Tracking */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="text-indigo-600" />
              Progresul stăpânirii (pe număr)
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(mastery).map(([num, data]) => {
                const masteryPercent = data.totalAttempts > 0
                  ? (data.correctAttempts / data.totalAttempts * 100).toFixed(0)
                  : 0;
                const isMastered = parseFloat(masteryPercent) >= 90;

                return (
                  <div key={num} className={`p-3 rounded-xl text-center ${
                    isMastered ? 'bg-green-100 border-2 border-green-400' :
                    parseFloat(masteryPercent) >= 70 ? 'bg-yellow-100 border-2 border-yellow-400' :
                    'bg-red-100 border-2 border-red-400'
                  }`}>
                    <div className="text-2xl font-bold mb-1">{num}</div>
                    <div className="text-xs font-medium">{masteryPercent}%</div>
                    {isMastered && <div className="text-xs text-green-600 mt-1">✓ Stăpânit</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Struggle Zones */}
          <div className="bg-red-50 p-6 rounded-xl border-2 border-red-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Brain className="text-red-600" />
              Zone dificile (de reluat)
            </h3>
            <div className="space-y-2">
              {stats.strugglingProblems.slice(0, 10).map((problem, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg flex justify-between items-center">
                  <span className="font-mono text-lg font-bold">{problem.a} + {problem.b}</span>
                  <span className="text-sm text-red-600 font-medium">{problem.attempts} încercări</span>
                </div>
              ))}
              {stats.strugglingProblems.length === 0 && (
                <p className="text-gray-600 text-center py-4">🎉 Nicio dificultate detectată! Minunat!</p>
              )}
            </div>
        </div>
      </div>
    </div>
  </div>
);
}

ParentDashboard.propTypes = {
  gameState: PropTypes.object.isRequired,
  aiRuntime: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

ParentDashboard.defaultProps = {
  aiRuntime: null,
};

export default ParentDashboard;
