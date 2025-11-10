import { useMemo, useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, XCircle, RotateCcw } from 'lucide-react';
import { LANGUAGE_TAGS } from '../lib/audio/warmupCatalog';

function PromptLanguageBadge({ language }) {
  if (!language) {
    return (
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
        Mix
      </span>
    );
  }
  const label = language === 'ro' ? 'RO' : 'EN';
  return (
    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
      {label}
    </span>
  );
}

export default function WarmupPromptModal({
  category,
  definition,
  prompts,
  selectedPromptIds,
  onClose,
  onTogglePrompt,
  onSelectAll,
  onClearSelection,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onResetCategory,
  isModified,
  disabled = false,
}) {
  const sortedPrompts = useMemo(() => {
    return [...prompts].sort((a, b) => {
      const langA = (a.language || '').localeCompare(b.language || '');
      if (langA !== 0) {
        return langA;
      }
      return a.text.localeCompare(b.text);
    });
  }, [prompts]);

  const [isAdding, setIsAdding] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftLanguage, setDraftLanguage] = useState('ro');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editLanguage, setEditLanguage] = useState('ro');

  const selectedSet = useMemo(() => new Set(selectedPromptIds || []), [selectedPromptIds]);
  const selectedCount = selectedSet.size;
  const totalPrompts = sortedPrompts.length;

  const handleStartAdd = () => {
    setIsAdding(true);
    setDraftText('');
    setDraftLanguage('ro');
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setDraftText('');
  };

  const handleSubmitAdd = () => {
    const text = draftText.trim();
    if (!text) {
      return;
    }
    onAddPrompt({
      text,
      language: draftLanguage,
    });
    setIsAdding(false);
    setDraftText('');
  };

  const handleStartEdit = (prompt) => {
    setEditingId(prompt.id);
    setEditText(prompt.text);
    setEditLanguage(prompt.language || 'ro');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleSubmitEdit = () => {
    if (!editingId) {
      return;
    }
    const text = editText.trim();
    if (!text) {
      return;
    }
    onUpdatePrompt(editingId, {
      text,
      language: editLanguage,
    });
    setEditingId(null);
    setEditText('');
  };

  const handleResetCategory = () => {
    if (!onResetCategory) return;
    if (window.confirm('Ești sigur că vrei să revii la lista implicită de prompturi?')) {
      onResetCategory();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Selecție prompturi</p>
            <h2 className="text-xl font-bold text-slate-900">{definition.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{definition.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Închide modalul"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">
              {selectedCount}/{totalPrompts} prompturi selectate
            </span>
            {isModified ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Listă personalizată
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={onSelectAll}
              disabled={disabled}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold transition ${
                disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              Selectează tot
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={disabled || selectedCount === 0}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold transition ${
                disabled || selectedCount === 0
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Deselectează
            </button>
            <button
              type="button"
              onClick={handleResetCategory}
              disabled={disabled || !isModified}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold transition ${
                disabled || !isModified
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-amber-200 text-amber-800 hover:bg-amber-300'
              }`}
            >
              <RotateCcw className="h-4 w-4" /> Resetează categoria
            </button>
          </div>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {sortedPrompts.map((prompt) => {
              const isEditing = editingId === prompt.id;
              const isSelected = selectedSet.has(prompt.id);
              return (
                <div
                  key={prompt.id}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                    isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={isSelected}
                    onChange={() => onTogglePrompt(prompt.id)}
                    disabled={disabled}
                  />
                  <div className="flex-1 space-y-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          disabled={disabled}
                        />
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <label className="font-semibold" htmlFor={`edit-language-${prompt.id}`}>
                            Limbă
                          </label>
                          <select
                            id={`edit-language-${prompt.id}`}
                            value={editLanguage}
                            onChange={(event) => setEditLanguage(event.target.value)}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            disabled={disabled}
                          >
                            {LANGUAGE_TAGS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-800">{prompt.text}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <PromptLanguageBadge language={prompt.language} />
                          {prompt.source === 'custom' ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Personalizat
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSubmitEdit}
                          disabled={disabled}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-600"
                        >
                          <Check className="h-4 w-4" /> Salvează
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-300"
                        >
                          <XCircle className="h-4 w-4" /> Renunță
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(prompt)}
                          disabled={disabled}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-300"
                        >
                          <Pencil className="h-4 w-4" /> Editează
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePrompt(prompt.id)}
                          disabled={disabled}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-200"
                        >
                          <Trash2 className="h-4 w-4" /> Șterge
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {sortedPrompts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Nu există prompturi în această categorie. Adaugă unul nou pentru a începe.
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {isAdding ? (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600" htmlFor={`new-prompt-${category}`}>
                  Text nou
                </label>
                <textarea
                  id={`new-prompt-${category}`}
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  disabled={disabled}
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <label className="font-semibold" htmlFor={`new-language-${category}`}>
                    Limbă
                  </label>
                  <select
                    id={`new-language-${category}`}
                    value={draftLanguage}
                    onChange={(event) => setDraftLanguage(event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    disabled={disabled}
                  >
                    {LANGUAGE_TAGS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitAdd}
                    disabled={disabled || !draftText.trim()}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow transition ${
                      disabled || !draftText.trim()
                        ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    <Check className="h-4 w-4" /> Adaugă prompt
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAdd}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-300"
                  >
                    Renunță
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartAdd}
                disabled={disabled}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
              >
                <Plus className="h-4 w-4" /> Adaugă prompt nou
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
