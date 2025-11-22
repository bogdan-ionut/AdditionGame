import { useEffect, useMemo, useRef, useState } from 'react';
import { ensurePersonalization } from '../../../lib/aiPersonalization';
import { createDefaultGameState, migrateGameState } from '../state/gameState';
import { computeAdditionStageProgress } from '../state/stages';

const LAST_USER_KEY = 'additionFlashcardsLastUser';

const loadInitialState = () => {
  try {
    const lastUser = localStorage.getItem(LAST_USER_KEY);
    if (lastUser) {
      const saved = localStorage.getItem(`additionFlashcardsGameState_${lastUser}`);
      if (saved) {
        const parsedState = JSON.parse(saved);
        if (parsedState?.studentInfo?.name === lastUser) {
          return migrateGameState(parsedState);
        }
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[addition] Unable to load saved game state', error);
    }
  }
  return createDefaultGameState();
};

export function usePersistentGameState() {
  const [gameState, setGameState] = useState(loadInitialState);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    try {
      if (gameState?.studentInfo?.name) {
        const userKey = `additionFlashcardsGameState_${gameState.studentInfo.name}`;
        localStorage.setItem(userKey, JSON.stringify(gameState));
        localStorage.setItem(LAST_USER_KEY, gameState.studentInfo.name);
      }
    } catch (error) {
      console.error('Failed to save game state:', error);
    }
  }, [gameState]);

  const aiPersonalization = useMemo(
    () => ensurePersonalization(gameState.aiPersonalization, gameState.studentInfo),
    [gameState.aiPersonalization, gameState.studentInfo],
  );

  const stageProgress = useMemo(
    () =>
      computeAdditionStageProgress(
        gameState.masteryTracking || {},
        gameState.achievements?.stageBadges || {},
      ),
    [gameState.achievements?.stageBadges, gameState.masteryTracking],
  );

  return {
    gameState,
    setGameState,
    gameStateRef,
    aiPersonalization,
    stageProgress,
  };
}
