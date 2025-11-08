import { useEffect, useMemo, useState } from 'react';
import './App.css';
import LearningPathDashboard from './components/learning-path/LearningPathDashboard.jsx';
import ParentAISettings from './components/ParentAISettings.jsx';
import { LEARNING_PATHS, OPERATIONS } from './lib/learningPaths.js';
import { moduleRegistry } from './modules/index.js';
import { flushMathGalaxyQueue, isMathGalaxyConfigured } from './services/mathGalaxyClient';

function App() {
  const [activePathId, setActivePathId] = useState(null);
  const [aiOffline, setAiOffline] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isMathGalaxyConfigured) return;
    flushMathGalaxyQueue().catch(() => {});
  }, []);

  useEffect(() => {
    const handleOffline = (event) => {
      setAiOffline(true);
    };
    const handleOnline = () => {
      setAiOffline(false);
    };
    const handleOpenSettings = () => {
      setAiSettingsOpen(true);
    };
    window.addEventListener('ai:offline', handleOffline);
    window.addEventListener('ai:online', handleOnline);
    window.addEventListener('ai:open-settings', handleOpenSettings);
    return () => {
      window.removeEventListener('ai:offline', handleOffline);
      window.removeEventListener('ai:online', handleOnline);
      window.removeEventListener('ai:open-settings', handleOpenSettings);
    };
  }, []);

  const openAiSettings = () => {
    setAiSettingsOpen(true);
  };

  const closeAiSettings = () => {
    setAiSettingsOpen(false);
  };

  const activePath = useMemo(() => {
    if (!activePathId) return null;
    return LEARNING_PATHS.find((path) => path.id === activePathId) || null;
  }, [activePathId]);

  const activeModule = activePath?.moduleKey ? moduleRegistry[activePath.moduleKey] : null;

  if (activePath && activeModule?.component) {
    const ModuleComponent = activeModule.component;
    return (
      <>
        <ModuleComponent
          learningPath={activePath}
          onExit={() => setActivePathId(null)}
          onOpenAiSettings={openAiSettings}
          aiOffline={aiOffline}
        />
        {aiSettingsOpen && (
          <ParentAISettings onClose={closeAiSettings} onSaved={closeAiSettings} />
        )}
      </>
    );
  }

  return (
    <>
      <LearningPathDashboard
        operations={OPERATIONS}
        learningPaths={LEARNING_PATHS}
        aiOffline={aiOffline}
        onOpenAiSettings={openAiSettings}
        onSelectPath={(path) => {
          if (!path) return;
          if (path.status !== 'available') return;
          if (!path.moduleKey) return;
          if (!moduleRegistry[path.moduleKey]) return;
          setActivePathId(path.id);
        }}
      />
      {aiSettingsOpen && (
        <ParentAISettings onClose={closeAiSettings} onSaved={closeAiSettings} />
      )}
    </>
  );
}

export default App;
