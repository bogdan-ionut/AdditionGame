import React from 'react';
import {
  Hash,
  Brain,
  Zap,
  Star,
  Trophy,
  User,
  BarChart3,
  Download,
  Upload,
  LogOut,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  FileQuestion,
} from 'lucide-react';
import NextUpCard from './NextUpCard';
import ParentDashboard from './ParentDashboard';

const ModeSelection = ({
  onSelectMode,
  gameState,
  onShowDashboard,
  onExport,
  onImport,
  onLogout,
  onOpenAiSettings,
  aiPersonalization,
  aiPreviewItem,
  aiPlanStatus,
  interestDraft,
  onInterestDraftChange,
  onAddInterest,
  onRemoveInterest,
  onStartAiPath,
  onRefreshPlan,
  spriteRateLimit,
  spriteRetryIn,
  spriteJobState,
  onGenerateSprites,
  jobStatus,
  aiEnabled,
}) => {
  const { studentInfo, statistics } = gameState;

  return (
    <div className="min-h-screen bg-sky-50 text-slate-800 flex flex-col items-center p-4">
      <header className="w-full max-w-4xl mx-auto flex justify-between items-center pb-4 border-b-2 border-sky-200">
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-500" size={24} />
          <h1 className="text-2xl font-bold text-sky-800">Addition Flashcards</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg">
            <User className="inline mr-2" size={20} />
            {studentInfo.name}
          </span>
          <button
            onClick={onShowDashboard}
            className="p-2 rounded-full hover:bg-sky-100 transition-colors"
            title="Parent Dashboard"
          >
            <BarChart3 size={24} className="text-sky-600" />
          </button>
          <button
            onClick={onOpenAiSettings}
            className="p-2 rounded-full hover:bg-sky-100 transition-colors"
            title="AI Settings"
          >
            <Settings size={24} className="text-sky-600" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-full hover:bg-sky-100 transition-colors"
            title="Logout"
          >
            <LogOut size={24} className="text-red-500" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto mt-8 flex-grow">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-light mb-2">Welcome back, {studentInfo.name}!</h2>
          <p className="text-slate-500">What would you like to practice today?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Practice Modes */}
          <ModeCard
            icon={<Zap className="w-12 h-12 mx-auto mb-4 text-yellow-500" />}
            title="Practice"
            description="Focus on a specific number."
            onClick={() => onSelectMode('focus')}
          />
          <ModeCard
            icon={<Star className="w-12 h-12 mx-auto mb-4 text-yellow-500" />}
            title="Review"
            description="Review past problems."
            onClick={() => onSelectMode('review')}
          />
          <ModeCard
            icon={<Hash className="w-12 h-12 mx-auto mb-4 text-yellow-500" />}
            title="Random"
            description="Random problems for a challenge."
            onClick={() => onSelectMode('random')}
          />
        </div>

        {aiEnabled && (
          <div className="mt-12 p-6 bg-white rounded-xl shadow-md border border-sky-200">
            <h3 className="text-2xl font-semibold text-sky-800 mb-4 flex items-center">
              <Brain size={28} className="mr-3 text-sky-500" />
              Your AI Learning Path
            </h3>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                {aiPreviewItem ? (
                  <NextUpCard
                    item={aiPreviewItem}
                    onStart={onStartAiPath}
                    status={aiPlanStatus.loading ? 'loading' : 'ready'}
                  />
                ) : (
                  <div className="text-center p-6 bg-slate-50 rounded-lg">
                    <FileQuestion size={40} className="mx-auto text-slate-400 mb-3" />
                    <p className="text-slate-600">No AI plan found.</p>
                    <button
                      onClick={onRefreshPlan}
                      className="mt-4 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors flex items-center justify-center mx-auto"
                      disabled={aiPlanStatus.loading}
                    >
                      <RefreshCw
                        size={16}
                        className={`mr-2 ${aiPlanStatus.loading ? 'animate-spin' : ''}`}
                      />
                      {aiPlanStatus.loading ? 'Generating...' : 'Generate Plan'}
                    </button>
                  </div>
                )}
              </div>
              <div className="w-full md:w-64">
                <InterestsPanel
                  interests={aiPersonalization.learnerProfile.interests}
                  interestDraft={interestDraft}
                  onInterestDraftChange={onInterestDraftChange}
                  onAddInterest={onAddInterest}
                  onRemoveInterest={onRemoveInterest}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const ModeCard = ({ icon, title, description, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow text-center transform hover:-translate-y-1"
  >
    {icon}
    <h3 className="text-2xl font-semibold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-500">{description}</p>
  </button>
);

const InterestsPanel = ({
  interests,
  interestDraft,
  onInterestDraftChange,
  onAddInterest,
  onRemoveInterest,
}) => (
  <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200 h-full">
    <h4 className="font-semibold text-slate-700 mb-3">Interests</h4>
    <div className="flex gap-2 mb-3">
      <input
        type="text"
        value={interestDraft}
        onChange={(e) => onInterestDraftChange(e.target.value)}
        placeholder="Add an interest..."
        className="flex-grow p-2 border rounded-lg text-sm"
      />
      <button
        onClick={onAddInterest}
        className="p-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600"
        title="Add Interest"
      >
        <Plus size={16} />
      </button>
    </div>
    <ul className="space-y-2">
      {interests &&
        interests.map((interest) => (
          <li
            key={interest}
            className="flex justify-between items-center bg-slate-100 px-3 py-1 rounded-md text-sm"
          >
            <span>{interest}</span>
            <button
              onClick={() => onRemoveInterest(interest)}
              className="text-slate-500 hover:text-red-600"
              title="Remove Interest"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
    </ul>
  </div>
);

export default ModeSelection;
