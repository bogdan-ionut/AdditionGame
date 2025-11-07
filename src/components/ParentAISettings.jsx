import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Lock, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { loadAiConfig, saveAiConfig, getAiRuntime } from '../lib/ai/runtime';
import { saveGeminiKey, testGeminiKey } from '../services/aiPlanner';
import { MathGalaxyApiError } from '../services/mathGalaxyClient';

const PLANNING_MODEL_OPTIONS = ['gemini-2.5-pro', 'gemini-2.5-flash'];
const SPRITE_MODEL_OPTIONS = ['gemini-2.5-flash-image'];
const AUDIO_MODEL_OPTIONS = ['gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts'];

const API_OFFLINE_MESSAGE = 'API offline sau URL greșit. Verifică VITE_MATH_API_URL.';

const initialRuntime = {
  aiEnabled: false,
  serverHasKey: false,
  planningModel: null,
  spriteModel: null,
  audioModel: null,
  aiAllowed: true,
  lastError: null,
};

const StatusChip = ({ active }) => (
  <span
    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
      active ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
    }`}
  >
    <span
      className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`}
      aria-hidden="true"
    />
    {active ? 'AI Enabled' : 'AI Disabled'}
  </span>
);

export default function ParentAISettings({ onClose, onSaved }) {
  const [keyInput, setKeyInput] = useState('');
  const [planningModel, setPlanningModel] = useState('');
  const [spriteModel, setSpriteModel] = useState('gemini-2.5-flash-image');
  const [audioModel, setAudioModel] = useState('');
  const [aiAllowed, setAiAllowed] = useState(true);
  const [runtime, setRuntime] = useState(initialRuntime);
  const [keyStatus, setKeyStatus] = useState({ state: 'idle', message: null });
  const [testStatus, setTestStatus] = useState({ state: 'idle', message: null, ok: null });
  const [modelStatus, setModelStatus] = useState({ state: 'idle', message: null });
  const [fieldErrors, setFieldErrors] = useState({ planningModel: null, spriteModel: null });

  const applyConfig = useCallback(() => {
    const cfg = loadAiConfig();
    setPlanningModel(cfg.planningModel || '');
    setSpriteModel(cfg.spriteModel || 'gemini-2.5-flash-image');
    setAudioModel(cfg.audioModel || '');
    setAiAllowed(cfg.aiAllowed !== false);
  }, []);

  const syncRuntime = useCallback(
    async (notify = false) => {
      const next = await getAiRuntime();
      setRuntime(next);
      setPlanningModel((prev) => {
        const trimmed = typeof prev === 'string' ? prev.trim() : '';
        return trimmed ? prev : next.planningModel || '';
      });
      setSpriteModel((prev) => {
        const trimmed = typeof prev === 'string' ? prev.trim() : '';
        return trimmed ? prev : next.spriteModel || 'gemini-2.5-flash-image';
      });
      setAudioModel((prev) => {
        const trimmed = typeof prev === 'string' ? prev.trim() : '';
        return trimmed ? prev : next.audioModel || '';
      });
      setAiAllowed(next.aiAllowed !== false);
      if (notify) {
        onSaved?.(next);
      }
      return next;
    },
    [onSaved],
  );

  useEffect(() => {
    applyConfig();
    syncRuntime(false);
  }, [applyConfig, syncRuntime]);

  const runHealthCheck = useCallback(
    async (notify = false) => {
      setTestStatus({ state: 'loading', ok: null, message: null });
      try {
        const response = await testGeminiKey();
        const ok = Boolean(response?.have_key ?? response?.haveKey ?? response?.server_has_key);
        const message = ok
          ? 'Gemini key detected on server.'
          : response?.error || response?.message || 'Gemini key missing on server.';
        setTestStatus({ state: 'success', ok, message });
        await syncRuntime(notify);
      } catch (error) {
        const message =
          error instanceof MathGalaxyApiError || error instanceof TypeError
            ? API_OFFLINE_MESSAGE
            : error?.message || API_OFFLINE_MESSAGE;
        setTestStatus({ state: 'error', ok: false, message });
        await syncRuntime(notify);
      }
    },
    [syncRuntime],
  );

  const handleSaveKey = useCallback(async () => {
    if (!keyInput.trim()) {
      setKeyStatus({ state: 'error', message: 'Please paste a valid Google Gemini API key.' });
      return;
    }
    setKeyStatus({ state: 'loading', message: null });
    try {
      const response = await saveGeminiKey(keyInput.trim());
      const message = response?.message
        || (response?.ok ? 'API key saved securely.' : null)
        || 'API key saved securely.';
      setKeyStatus({ state: 'success', message });
      setKeyInput('');
      await runHealthCheck(true);
    } catch (error) {
      const message =
        error instanceof MathGalaxyApiError || error instanceof TypeError
          ? API_OFFLINE_MESSAGE
          : error?.message || 'We could not save the API key. Please try again.';
      setKeyStatus({ state: 'error', message });
    }
  }, [keyInput, runHealthCheck]);

  const handleSaveModels = useCallback(async () => {
    const nextErrors = {
      planningModel: planningModel.trim() ? null : 'Planning model is required.',
      spriteModel: spriteModel.trim() ? null : 'Sprite model is required.',
    };
    setFieldErrors(nextErrors);
    if (nextErrors.planningModel || nextErrors.spriteModel) {
      setModelStatus({ state: 'error', message: 'Please provide required models before saving.' });
      return;
    }

    setModelStatus({ state: 'loading', message: null });
    try {
      saveAiConfig({
        planningModel: planningModel.trim(),
        spriteModel: spriteModel.trim(),
        audioModel: audioModel.trim() ? audioModel.trim() : null,
        aiAllowed,
      });
      setModelStatus({ state: 'success', message: 'Model preferences saved.' });
      await syncRuntime(true);
    } catch (error) {
      setModelStatus({ state: 'error', message: error.message || 'Unable to save model preferences.' });
    }
  }, [aiAllowed, audioModel, planningModel, spriteModel, syncRuntime]);

  const toggleAiAllowed = useCallback(() => {
    setAiAllowed((prev) => !prev);
    setModelStatus({ state: 'idle', message: null });
  }, []);

  const aiToggleLabel = useMemo(() => (aiAllowed ? 'AI features will run when enabled.' : 'AI features are paused until you re-enable them.'), [aiAllowed]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-800">AI Settings</h2>
              <StatusChip active={runtime.aiEnabled} />
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Key configured on server: <span className="font-semibold">{runtime.serverHasKey ? 'Yes' : 'No'}</span></p>
              <p>AI enabled: <span className="font-semibold">{runtime.aiEnabled ? 'Yes' : 'No'}</span> (needs key + planning model + sprite model + toggle on)</p>
              {runtime.lastError && (
                <p className="text-red-600 font-medium flex items-center gap-2">
                  <AlertCircle size={14} /> {runtime.lastError}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
            aria-label="Close AI settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex gap-3">
          <Lock className="text-indigo-500" size={24} />
          <div className="text-sm text-indigo-800 space-y-1">
            <p className="font-semibold">Why we need this</p>
            <p>
              We use your key only on the server (the browser never sees it). Planning runs on text models, while sprite batches use Gemini image models. Pick any Gemini model name or select one from the list.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700" htmlFor="gemini-key">
            Google Gemini API key
          </label>
          <input
            id="gemini-key"
            type="password"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSaveKey}
              disabled={keyStatus.state === 'loading'}
              className={`px-5 py-3 rounded-xl font-semibold text-white shadow ${
                keyStatus.state === 'loading' ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {keyStatus.state === 'loading' ? (
                <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Saving…</span>
              ) : (
                'Save API key'
              )}
            </button>
            <button
              onClick={() => runHealthCheck(true)}
              disabled={testStatus.state === 'loading'}
              className={`px-5 py-3 rounded-xl font-semibold border-2 shadow-sm ${
                testStatus.state === 'loading'
                  ? 'border-gray-300 text-gray-500 cursor-wait'
                  : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              {testStatus.state === 'loading' ? (
                <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Testing…</span>
              ) : (
                'Test key'
              )}
            </button>
          </div>
          {keyStatus.state === 'success' && keyStatus.message && (
            <div className="flex items-start gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-2xl p-4">
              <ShieldCheck className="text-green-500" size={18} />
              <span>{keyStatus.message}</span>
            </div>
          )}
          {keyStatus.state === 'error' && keyStatus.message && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
              {keyStatus.message}
            </div>
          )}
          {testStatus.state !== 'idle' && testStatus.message && (
            <div
              className={`flex items-center gap-2 text-sm rounded-2xl border px-3 py-2 ${
                testStatus.ok
                  ? 'text-green-600 bg-green-50 border-green-200'
                  : 'text-red-600 bg-red-50 border-red-200'
              }`}
            >
              {testStatus.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700" htmlFor="planning-model">
              Planning / thinking model
            </label>
            <input
              id="planning-model"
              type="text"
              list="planning-model-options"
              value={planningModel}
              onChange={(event) => setPlanningModel(event.target.value)}
              placeholder="gemini-2.5-pro"
              className={`w-full px-4 py-3 border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                fieldErrors.planningModel ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {fieldErrors.planningModel && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.planningModel}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700" htmlFor="sprite-model">
              Sprite generation model
            </label>
            <input
              id="sprite-model"
              type="text"
              list="sprite-model-options"
              value={spriteModel}
              onChange={(event) => setSpriteModel(event.target.value)}
              placeholder="gemini-2.5-flash-image"
              className={`w-full px-4 py-3 border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                fieldErrors.spriteModel ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {fieldErrors.spriteModel && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.spriteModel}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700" htmlFor="audio-model">
              Audio / TTS model
            </label>
            <input
              id="audio-model"
              type="text"
              list="audio-model-options"
              value={audioModel}
              onChange={(event) => setAudioModel(event.target.value)}
              placeholder="gemini-2.5-pro-preview-tts"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="mt-1 text-xs text-gray-500">Optional for now—future updates will use this for narrated hints.</p>
          </div>

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">AI features toggle</p>
              <p className="text-xs text-gray-500">{aiToggleLabel}</p>
            </div>
            <button
              type="button"
              onClick={toggleAiAllowed}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                aiAllowed ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
              aria-pressed={aiAllowed}
            >
              <span className="sr-only">Toggle AI features</span>
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  aiAllowed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {aiAllowed === false && (
            <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-2xl px-3 py-2">
              AI calls are paused. We&apos;ll use the local planner and sprites until you re-enable the toggle and save.
            </div>
          )}

          <button
            onClick={handleSaveModels}
            disabled={modelStatus.state === 'loading'}
            className={`w-full px-5 py-3 rounded-xl font-semibold text-white shadow ${
              modelStatus.state === 'loading' ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {modelStatus.state === 'loading' ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Saving…</span>
            ) : (
              'Save model choices'
            )}
          </button>

          {modelStatus.state === 'success' && modelStatus.message && (
            <div className="flex items-start gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-2xl p-4">
              <ShieldCheck className="text-green-500" size={18} />
              <span>{modelStatus.message}</span>
            </div>
          )}
          {modelStatus.state === 'error' && modelStatus.message && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
              {modelStatus.message}
            </div>
          )}
        </div>
      </div>

      <datalist id="planning-model-options">
        {PLANNING_MODEL_OPTIONS.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
      <datalist id="sprite-model-options">
        {SPRITE_MODEL_OPTIONS.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
      <datalist id="audio-model-options">
        {AUDIO_MODEL_OPTIONS.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
    </div>
  );
}
