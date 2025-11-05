import { useEffect, useState, useCallback } from 'react';
import { X, Lock, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';
import { loadAiConfig, saveAiConfig } from '../lib/ai/config';
import { getAiRuntime } from '../lib/ai/runtime';

async function testApiKey() {
  try {
    const response = await fetch('https://ionutbogdan.ro/api/health/gemini_post.php');
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    const data = await response.json();
    return { success: true, hasKey: data?.have_key ?? false };
  } catch (error) {
    return { success: false, hasKey: false, error: error.message };
  }
}

export default function ParentAISettings({ onClose, onSaved, saveKey }) {
  const [apiKey, setApiKey] = useState('');
  const [planningModel, setPlanningModel] = useState('');
  const [spriteModel, setSpriteModel] = useState('');
  const [runtimeState, setRuntimeState] = useState({
    aiEnabled: false,
    serverHasKey: false,
  });
  const [status, setStatus] = useState({
    key: { saving: false, success: false, error: null, message: null },
    models: { saving: false, success: false, error: null, message: null },
    test: { testing: false, success: false, error: null, message: null },
  });

  const refreshRuntime = useCallback(async () => {
    setStatus(s => ({ ...s, test: { ...s.test, testing: true } }));
    const state = await getAiRuntime();
    setRuntimeState(state);
    setStatus(s => ({ ...s, test: { ...s.test, testing: false } }));
  }, []);

  useEffect(() => {
    const config = loadAiConfig();
    setPlanningModel(config.planningModel || 'gemini-2.5-pro');
    setSpriteModel(config.spriteModel || 'gemini-2.5-flash-image');
    refreshRuntime();
  }, [refreshRuntime]);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      setStatus(s => ({ ...s, key: { ...s.key, error: 'Please paste a valid Google Gemini API key.' } }));
      return;
    }
    setStatus({ ...status, key: { saving: true, success: false, error: null, message: null } });
    try {
      await saveKey(apiKey.trim());
      setStatus(s => ({ ...s, key: { saving: false, success: true, message: 'API key stored securely on server.' } }));
      setApiKey('');
      await refreshRuntime();
      onSaved?.();
    } catch (error) {
      setStatus(s => ({ ...s, key: { saving: false, error: error.message || 'Could not save the API key.' } }));
    }
  };

  const handleTestKey = async () => {
    setStatus(s => ({ ...s, test: { testing: true, success: false, error: null, message: null } }));
    const result = await testApiKey();
    if (result.success) {
      const message = result.hasKey ? 'Key OK' : 'Key not found on server.';
      setStatus(s => ({ ...s, test: { testing: false, success: result.hasKey, message } }));
    } else {
      setStatus(s => ({ ...s, test: { testing: false, error: result.error } }));
    }
    await refreshRuntime();
  };

  const handleSaveModels = () => {
    if (!planningModel || !spriteModel) {
      setStatus(s => ({ ...s, models: { error: 'Please select both a planning and a sprite model.' } }));
      return;
    }
    saveAiConfig({ planningModel, spriteModel });
    setStatus(s => ({ ...s, models: { success: true, message: 'Model choices saved locally.' } }));
    refreshRuntime();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">AI Settings</h2>
            <p className="text-sm text-gray-600 mt-1">Configure your own Google Gemini models for personalized learning.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1 rounded-full"><X size={20} /></button>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex gap-3">
          <Lock className="text-indigo-500 flex-shrink-0" size={24} />
          <div className="text-sm text-indigo-800">
            <p className="font-semibold">Why we need this</p>
            <p>We use your key only on the server (browser never sees it). Planning uses text models; sprites use image models.</p>
          </div>
        </div>

        {/* --- API Key Section --- */}
        <div className="space-y-3 p-4 border rounded-2xl">
          <label className="block text-sm font-medium text-gray-700" htmlFor="gemini-key">Google Gemini API key</label>
          <input id="gemini-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..." className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl" />
          <div className="flex flex-wrap gap-3">
            <button onClick={handleSaveKey} disabled={status.key.saving} className="px-5 py-2 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400">
              {status.key.saving ? 'Saving…' : 'Save API Key'}
            </button>
            <button onClick={handleTestKey} disabled={status.test.testing} className="px-5 py-2 rounded-xl font-semibold bg-white border-2 border-gray-200 hover:bg-gray-50 disabled:bg-gray-300">
              {status.test.testing ? 'Testing…' : 'Test Key'}
            </button>
          </div>
          {status.key.error && <div className="text-sm text-red-600">{status.key.error}</div>}
          {status.key.success && <div className="text-sm text-green-600">{status.key.message}</div>}
          {status.test.message && <div className={`text-sm ${status.test.success ? 'text-green-600' : 'text-yellow-700'}`}>{status.test.message}</div>}
          {status.test.error && <div className="text-sm text-red-600">{status.test.error}</div>}
        </div>

        {/* --- Model Selection Section --- */}
        <div className="space-y-4 p-4 border rounded-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="planning-model" className="block text-sm font-medium text-gray-700 mb-1">Planning model</label>
              <select id="planning-model" value={planningModel} onChange={(e) => setPlanningModel(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl">
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              </select>
            </div>
            <div>
              <label htmlFor="sprite-model" className="block text-sm font-medium text-gray-700 mb-1">Sprite model</label>
              <input id="sprite-model" type="text" value={spriteModel} onChange={(e) => setSpriteModel(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl" placeholder="e.g., gemini-2.5-flash-image" />
            </div>
          </div>
          <button onClick={handleSaveModels} className="px-5 py-2 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700">Save Model Choices</button>
          {status.models.error && <div className="text-sm text-red-600">{status.models.error}</div>}
          {status.models.success && <div className="text-sm text-green-600">{status.models.message}</div>}
        </div>

        {/* --- Status Section --- */}
        <div className="flex items-center gap-4 text-sm bg-gray-50 p-3 rounded-2xl">
          <div className="flex items-center gap-2">
            {runtimeState.serverHasKey ? <CheckCircle className="text-green-500" size={18} /> : <AlertTriangle className="text-yellow-500" size={18} />}
            <span>Key configured on server: <strong>{runtimeState.serverHasKey ? 'Yes' : 'No'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            {runtimeState.aiEnabled ? <CheckCircle className="text-green-500" size={18} /> : <AlertTriangle className="text-yellow-500" size={18} />}
            <span>AI enabled: <strong>{runtimeState.aiEnabled ? 'Yes' : 'No'}</strong></span>
          </div>
        </div>

      </div>
    </div>
  );
}
