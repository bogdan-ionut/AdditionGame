import { hasGeminiApiKey } from '../lib/gemini/apiKey';

export type RuntimeInfo = {
  ok: boolean;
  runtimeLabel: string | null;
  ttsModel: string | null;
  planningModel?: string | null;
  spriteModel?: string | null;
  note?: string | null;
};

export async function fetchRuntime(): Promise<RuntimeInfo> {
  const hasKey = hasGeminiApiKey();
  return {
    ok: hasKey,
    runtimeLabel: hasKey ? 'Gemini (browser)' : 'Offline',
    ttsModel: hasKey ? 'gemini-2.5-flash-preview-tts' : null,
    note: hasKey
      ? 'Vocea este generată direct în browser folosind cheia ta Gemini.'
      : 'Configurează cheia Gemini în AI Settings pentru a activa vocea.',
  };
}

export const fetchVoices = async () => [
  {
    id: 'Kore',
    label: 'Kore · Română prietenoasă',
    language: 'ro-RO',
  },
  {
    id: 'Juniper',
    label: 'Juniper · English upbeat',
    language: 'en-US',
  },
];

export const fetchSfx = async () => ({
  packs: ['default'],
});
