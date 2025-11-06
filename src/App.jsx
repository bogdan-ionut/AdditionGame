import { useMemo, useState } from 'react';
import './App.css';
import LearningPathDashboard from './components/learning-path/LearningPathDashboard.jsx';
import { LEARNING_PATHS, OPERATIONS } from './lib/learningPaths.js';
import { moduleRegistry } from './modules/index.js';

function App() {
  const [activePathId, setActivePathId] = useState(null);

  const activePath = useMemo(() => {
    if (!activePathId) return null;
    return LEARNING_PATHS.find((path) => path.id === activePathId) || null;
  }, [activePathId]);

  const activeModule = activePath?.moduleKey ? moduleRegistry[activePath.moduleKey] : null;

  if (activePath && activeModule?.component) {
    const ModuleComponent = activeModule.component;
    return (
      <ModuleComponent
        learningPath={activePath}
        onExit={() => setActivePathId(null)}
      />
    );
  }

  return (
    <LearningPathDashboard
      operations={OPERATIONS}
      learningPaths={LEARNING_PATHS}
      onSelectPath={(path) => {
        if (!path) return;
        if (path.status !== 'available') return;
        if (!path.moduleKey) return;
        if (!moduleRegistry[path.moduleKey]) return;
        setActivePathId(path.id);
      }}
    />
  );
}

export default App;
