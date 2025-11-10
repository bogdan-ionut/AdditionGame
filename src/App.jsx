import { useEffect, useMemo, useState } from 'react';
import './App.css';
import LearningPathDashboard from './components/learning-path/LearningPathDashboard.jsx';
import ParentAISettings from './components/ParentAISettings.jsx';
import { LEARNING_PATHS, OPERATIONS } from './lib/learningPaths.js';
import { moduleRegistry } from './modules/index.js';
import ToastHost from './components/ToastHost.jsx';
import { fetchRuntime } from './services/api';
import { showToast } from './lib/ui/toast';

function App() {
  const [activePathId, setActivePathId] = useState(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchRuntime()
      .then((payload) => {
        if (cancelled) return;
        if (payload && typeof payload === 'object') {
          setRuntimeInfo(payload);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setRuntimeInfo(null);
        const message =
          (error && typeof error.message === 'string' && error.message) ||
          'Unable to contact Math Galaxy runtime. Check AI Settings.';
        showToast({ level: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shouldReopen = window.sessionStorage.getItem('mg.aiSettings.reopen');
    if (shouldReopen === 'true') {
      setAiSettingsOpen(true);
      window.sessionStorage.removeItem('mg.aiSettings.reopen');
    }
  }, []);

  useEffect(() => {
    const handleOpenSettings = () => {
      setAiSettingsOpen(true);
    };
    window.addEventListener('ai:open-settings', handleOpenSettings);
    return () => {
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
        <ToastHost />
        <ModuleComponent
          learningPath={activePath}
          onExit={() => setActivePathId(null)}
          onOpenAiSettings={openAiSettings}
        />
        {aiSettingsOpen && (
          <ParentAISettings onClose={closeAiSettings} />
        )}
      </>
    );
  }

  return (
    <>
      <ToastHost />
      <LearningPathDashboard
        operations={OPERATIONS}
        learningPaths={LEARNING_PATHS}
        onOpenAiSettings={openAiSettings}
        runtimeInfo={runtimeInfo}
        onSelectPath={(path) => {
          if (!path) return;
          if (path.status !== 'available') return;
          if (!path.moduleKey) return;
          if (!moduleRegistry[path.moduleKey]) return;
          setActivePathId(path.id);
        }}
      />
      {aiSettingsOpen && (
        <ParentAISettings onClose={closeAiSettings} />
      )}
    </>
  );
}

export default App;
