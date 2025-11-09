export default function AiOfflineBanner({ onOpenSettings }) {
  return (
    <div className="mx-4 my-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          Cloud AI needs a valid Base URL with CORS. Click “Open AI Settings”, then set:
          <code className="ml-1 rounded bg-white/60 px-1">https://math-api-811756754621.us-central1.run.app</code>
        </p>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Open AI Settings
        </button>
      </div>
    </div>
  );
}
