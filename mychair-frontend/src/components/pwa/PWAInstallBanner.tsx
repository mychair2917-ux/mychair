import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  className?: string;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ className = '' }) => {
  const { canInstall, isInstalled, isIOS, hasNativePrompt, install, dismiss, isDismissed } =
    usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || isDismissed || !canInstall) {
    return null;
  }

  const handleInstallClick = async () => {
    if (hasNativePrompt) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide((prev) => !prev);
    }
  };

  return (
    <div
      className={`relative mx-auto w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300 ${className}`}
    >
      <div className="mx-3 mb-3 overflow-hidden rounded-2xl border border-[var(--color-brand-gold-light)]/40 bg-gradient-to-r from-white via-[#fdfbf7] to-amber-50/50 p-4 shadow-md sm:mx-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border-soft)] shadow-2xs">
              <img src="/icons/icon-192x192.png" alt="MyChair" className="h-7 w-7 rounded-lg object-contain" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--color-text-primary)]">Install MyChair</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Add MyChair to your phone for faster access.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showIOSGuide && (
          <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-xs text-amber-900 animate-in fade-in duration-200">
            <p className="font-semibold mb-1">To install on iPhone / iPad:</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>
                Tap the <Share className="inline h-3.5 w-3.5 mx-0.5 text-blue-600 -mt-0.5" /> <strong>Share</strong> icon in Safari.
              </li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top right.</li>
            </ol>
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-dark)] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition"
          >
            {isIOS && !hasNativePrompt ? (
              <>
                <Share className="h-3.5 w-3.5" />
                {showIOSGuide ? 'Hide instructions' : 'How to install'}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Install
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
