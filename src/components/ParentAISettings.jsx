import { useEffect, useState } from 'react';
import { X, Lock, ShieldCheck } from 'lucide-react';
import { getGeminiKeyStatus } from '../services/aiPlanner';

export default function ParentAISettings({ onClose, onSaved, saveKey }) {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState({ saving: false, success: false, error: null, message: null });
  const [savedLocation, setSavedLocation] = useState(null);
  const [savedPreview, setSavedPreview] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    const existing = getGeminiKeyStatus();
    if (existing.configured) {
      setSavedLocation(existing.location);
      setSavedPreview(existing.preview);
      setSavedAt(existing.savedAt);
      setStatus({ saving: false, success: false, error: null, message: null });
    } else {
      setSavedLocation(null);
      setSavedPreview(null);
      setSavedAt(null);
      setStatus({ saving: false, success: false, error: null, message: null });
    }
  }, []);

  const handleSave = async () => {
    if (!key.trim()) {
      setStatus({ saving: false, success: false, error: 'Please paste a valid Google Gemini API key.', message: null });
      return;
    }

    setStatus({ saving: true, success: false, error: null, message: null });
    try {
      const response = await saveKey(key.trim());
      setStatus({
        saving: false,
        success: true,
        error: null,
        message: response?.message || 'API key saved securely.',
      });
      setSavedLocation(response?.remote ? 'remote' : 'local');
      setSavedPreview(response?.remote ? null : key.trim().slice(0, 8));
      setSavedAt(new Date().toISOString());
      setKey('');
      onSaved?.(response);
    } catch (error) {
      setStatus({
        saving: false,
        success: false,
        error: error.message || 'We could not save the API key. Please try again.',
        message: null,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">AI Settings</h2>
            <p className="text-sm text-gray-600 mt-1">
              Paste your Google Gemini API key. We store it securely on your server (or locally for demos) so the browser never sees it again.
            </p>
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
          <div className="text-sm text-indigo-800">
            <p className="font-semibold">Why we need this</p>
            <p>
              The Gemini 2.5 Pro model crafts personalized lesson plans, while Gemini Nano helps generate interest motifs on-device.
              Your key lets us call these models from the secure edge proxy you configure.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700" htmlFor="gemini-key">
            Google Gemini API key
          </label>
          <input
            id="gemini-key"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {savedLocation && (
          <div className="flex items-start gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
            <ShieldCheck className="text-indigo-500" size={18} />
            <div>
              <p className="font-semibold">Key configured</p>
              <p>
                {savedLocation === 'remote'
                  ? 'Stored via your secure proxy. '
                  : 'Stored locally for demo use. '}
                {savedPreview ? `Begins with ${savedPreview}. ` : ''}
                {savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}.` : ''}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={status.saving}
            className={`px-5 py-3 rounded-xl font-semibold text-white shadow ${
              status.saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {status.saving ? 'Saving…' : 'Save API Key'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl font-semibold bg-white border-2 border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        {status.success && (
          <div className="flex items-start gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-2xl p-4">
            <ShieldCheck className="text-green-500" size={18} />
            <span>{status.message}</span>
          </div>
        )}

        {status.error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
            {status.error}
          </div>
        )}
      </div>
    </div>
  );
}
