import { useEffect, useState, useCallback } from 'react';
import { X, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { loadAiConfig, saveAiConfig } from '../lib/ai/config';
import { getAiRuntime } from '../lib/ai/runtime';
import { PlanningModel, SpriteModel } from '../lib/ai/models';

export default function ParentAISettings({ onClose, onSaved, saveKey }) {
  const [apiKey, setApiKey] = useState('');
  const [planningModel, setPlanningModel] = useState('');
  const [spriteModel, setSpriteModel] = useState('');
  const [runtimeState, setRuntimeState] = useState({
    aiEnabled: false,
    serverHasKey: false,
  });
  const [status, setStatus] = useState({
    saving: false,
    success: false,
    error: null,
    message: null,
  });

  const refreshRuntime = useCallback(async () => {
    const state = await getAiRuntime();
    setRuntimeState(state);
  }, []);

  useEffect(() => {
    const config = loadAiConfig();
    setPlanningModel(config.planningModel || 'gemini-2.5-pro');
    setSpriteModel(config.spriteModel || 'gemini-2.5-flash-image');
    refreshRuntime();
  }, [refreshRuntime]);

  const handleSave = async () => {
    if (!apiKey.trim() && !runtimeState.serverHasKey) {
      setStatus({ ...status, error: 'Please paste a valid Google Gemini API key.' });
      return;
    }
    if (!planningModel || !spriteModel) {
      setStatus({ ...status, error: 'Please select both a planning and a sprite model.' });
      return;
    }

    setStatus({ saving: true, success: false, error: null, message: null });
    try {
      if (apiKey.trim()) {
        await saveKey(apiKey.trim());
      }
      saveAiConfig({ planningModel, spriteModel });
      setStatus({ saving: false, success: true, message: 'Settings saved successfully.' });
      setApiKey('');
      await refreshRuntime();
      onSaved?.();
    } catch (error) {
      setStatus({ saving: false, error: error.message || 'Could not save settings.' });
    }
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
              <select id="sprite-model" value={spriteModel} onChange={(e) => setSpriteModel(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl">
                <option value="gemini-2.5-flash-image">Flash-Image (aka Nano Banana)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={handleSave} disabled={status.saving || (!apiKey.trim() && !runtimeState.serverHasKey) || !planningModel || !spriteModel} className="px-5 py-2 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400">
            {status.saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
        {status.error && <div className="text-sm text-red-600">{status.error}</div>}
        {status.success && <div className="text-sm text-green-600">{status.message}</div>}

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
