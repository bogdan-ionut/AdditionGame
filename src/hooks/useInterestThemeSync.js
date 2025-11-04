import { useCallback, useEffect } from 'react';
import {
  ensurePersonalization,
  deriveMotifsFromInterests,
} from '../lib/aiPersonalization';
import {
  buildThemePacksForInterests,
  maybeGenerateOnDeviceThemePacks,
} from '../lib/motifThemes';
import { requestInterestMotifs } from '../services/aiPlanner';

const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;

export default function useInterestThemeSync({ aiPersonalization, setGameState }) {
  const refreshInterestMotifs = useCallback(
    async (interests) => {
      if (!Array.isArray(interests)) return;

      if (interests.length === 0) {
        setGameState((prev) => {
          const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
          if (
            !ai.learnerProfile.interestMotifs?.length &&
            !ai.learnerProfile.interestThemePacks?.length
          ) {
            return prev;
          }
          return {
            ...prev,
            aiPersonalization: {
              ...ai,
              learnerProfile: {
                ...ai.learnerProfile,
                interestMotifs: [],
                interestThemePacks: [],
                motifsUpdatedAt: Date.now(),
                interestThemeDebug: null,
              },
            },
          };
        });
        return;
      }

      let motifsFromAi = [];
      let themePacksFromAi = [];
      let motifModel = null;
      let remoteThemePackCount = 0;
      let remoteMotifCount = 0;
      let remoteModel = null;

      const baseNanoDebug = {
        available: typeof window !== 'undefined' && !!window.ai?.assistant?.create,
        attempted: false,
        model: 'gemini-nano-banana',
        error: null,
        rawText: null,
        parsedCount: 0,
        returnedCount: 0,
        timestamp: Date.now(),
      };
      let onDeviceDebug = baseNanoDebug;

      try {
        const payload = await requestInterestMotifs(interests);
        if (payload) {
          motifsFromAi = Array.isArray(payload.motifs) ? payload.motifs : [];
          themePacksFromAi = Array.isArray(payload.themePacks) ? payload.themePacks : [];
          motifModel = payload.model || null;
          remoteModel = motifModel;
          remoteThemePackCount = themePacksFromAi.length;
          remoteMotifCount = motifsFromAi.length;
        }
      } catch (error) {
        console.warn('Interest motif request failed, using fallback motifs.', error);
      }

      if (!themePacksFromAi.length) {
        const onDeviceResult = await maybeGenerateOnDeviceThemePacks(interests, { includeDebug: true });
        if (onDeviceResult?.debug) {
          onDeviceDebug = { ...baseNanoDebug, ...onDeviceResult.debug };
        }
        const onDevicePacks = onDeviceResult?.packs || [];
        if (onDevicePacks.length) {
          themePacksFromAi = onDevicePacks;
          if (!motifModel) motifModel = onDeviceDebug.model || 'gemini-nano-banana';
        }
      } else {
        onDeviceDebug = baseNanoDebug;
      }

      const motifsToStore = motifsFromAi.length
        ? motifsFromAi
        : deriveMotifsFromInterests(interests);

      const themePacksToStore = buildThemePacksForInterests(interests, {
        basePacks: themePacksFromAi,
        motifHints: motifsToStore,
      }).map((pack) => {
        if (pack.source === 'ai' && motifModel) {
          return { ...pack, source: motifModel };
        }
        return pack;
      });

      const updatedAt = Date.now();
      const themeDebugSummary = {
        remote: {
          model: remoteModel,
          themeCount: remoteThemePackCount,
          motifCount: remoteMotifCount,
        },
        onDevice: onDeviceDebug,
        final: {
          model: motifModel,
          themeCount: themePacksToStore.length,
          motifCount: motifsToStore.length,
        },
        updatedAt,
      };

      setGameState((prev) => {
        const ai = ensurePersonalization(prev.aiPersonalization, prev.studentInfo);
        return {
          ...prev,
          aiPersonalization: {
            ...ai,
            learnerProfile: {
              ...ai.learnerProfile,
              interestMotifs: motifsToStore,
              interestThemePacks: themePacksToStore,
              motifsUpdatedAt: updatedAt,
              interestThemeDebug: themeDebugSummary,
            },
          },
        };
      });
    },
    [setGameState],
  );

  useEffect(() => {
    const interests = aiPersonalization.learnerProfile?.interests || [];
    if (!interests.length) {
      return;
    }

    const lastUpdated = aiPersonalization.learnerProfile?.motifsUpdatedAt;
    if (!lastUpdated) {
      refreshInterestMotifs(interests);
      return;
    }

    const ageMs = Date.now() - lastUpdated;
    if (ageMs > ONE_WEEK_MS) {
      refreshInterestMotifs(interests);
    }
  }, [aiPersonalization.learnerProfile?.interests, aiPersonalization.learnerProfile?.motifsUpdatedAt, refreshInterestMotifs]);

  return refreshInterestMotifs;
}
