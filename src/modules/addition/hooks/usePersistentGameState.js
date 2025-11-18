import { useState, useEffect, useRef, useMemo } from 'react';
import {
  createDefaultGameState,
  migrateGameState,
  dayKey,
} from '../state/gameState';
import {
  computeAdditionStageProgress,
} from '../state/stages';
import {
  ensurePersonalization,
} from '../../../lib/aiPersonalization';

const STORAGE_KEY = 'addition-game-state-v2';

export function usePersistentGameState() {
  const [gameState, setGameState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return migrateGameState(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load game state', e);
    }
    return createDefaultGameState();
  });

  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.error('Failed to save game state', e);
    }
  }, [gameState]);

  const aiPersonalization = useMemo(() => {
    return ensurePersonalization(gameState.aiPersonalization, gameState.studentInfo);
  }, [gameState.aiPersonalization, gameState.studentInfo]);

  const stageProgress = useMemo(() => {
    return computeAdditionStageProgress(
      gameState.masteryTracking,
      gameState.achievements?.stageBadges || {}
    );
  }, [gameState.masteryTracking, gameState.achievements]);

  return {
    gameState,
    setGameState,
    gameStateRef,
    aiPersonalization,
    stageProgress,
  };
}
