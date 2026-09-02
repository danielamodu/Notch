import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Trash2, PenLine, Sparkles } from 'lucide-react';

export const NotepadTab: React.FC = () => {
  const [noteText, setNoteText] = useState<string>(() => {
    try {
      return localStorage.getItem('apex_scratchpad') || '';
    } catch {
      return '';
    }
  });

  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('apex_scratchpad', noteText);
    } catch {}
  }, [noteText]);

  const handleCopy = async () => {
    if (!noteText.trim()) return;
    try {
      await navigator.clipboard.writeText(noteText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleClear = () => {
    setNoteText('');
    textareaRef.current?.focus();
  };

  const wordCount = noteText.trim() ? noteText.trim().split(/\s+/).length : 0;
  const charCount = noteText.length;

  return (
    <div className="flex flex-col h-full px-3.5 pt-1.5 pb-2.5 text-white select-none overflow-hidden gap-1.5">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[11px] text-neutral-400 shrink-0">
        <div className="flex items-center gap-1.5 text-neutral-300">
          <PenLine className="size-3 text-neutral-400" />
          <span className="font-semibold text-white">Scratchpad</span>
          <span className="text-[10px] text-neutral-500 font-mono">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {noteText.length > 0 && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[10px] text-neutral-300 hover:text-white transition"
                title="Copy note to clipboard"
              >
                {copied ? <Check className="size-2.5 text-emerald-400" /> : <Copy className="size-2.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleClear}
                className="p-1 rounded hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 transition"
                title="Clear notepad"
              >
                <Trash2 className="size-2.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notepad Paper Area */}
      <div className="flex-1 relative rounded-xl bg-neutral-900/90 border border-white/5 overflow-hidden p-2 flex flex-col">
        <textarea
          ref={textareaRef}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Drop ideas, notes, links, or things to remember here..."
          className="size-full bg-transparent border-0 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none leading-relaxed custom-scrollbar font-sans select-text"
          autoFocus
          spellCheck={false}
        />
        {noteText.length === 0 && (
          <div className="absolute right-2.5 bottom-2 pointer-events-none flex items-center gap-1 text-[10px] text-neutral-600 font-mono">
            <Sparkles className="size-2.5" />
            <span>Auto-saved</span>
          </div>
        )}
      </div>
    </div>
  );
};
