/**
 * SupplicationScreen
 *
 * Full content-band display for a fixed congregational supplication
 * (Arabic, transliteration, translation). Scales all text to fit the
 * available band exactly — no scrolling.
 */

import React from 'react';
import type { HardcodedSupplication } from '@/constants/scheduledSupplications';
import useSupplicationFit from '@/hooks/useSupplicationFit';

export interface SupplicationScreenProps {
  supplication: HardcodedSupplication;
  /** True in portrait — narrower measure; landscape uses the full content-band width. */
  compact?: boolean;
}

const SupplicationScreen: React.FC<SupplicationScreenProps> = ({
  supplication,
  compact = false,
}) => {
  const { containerRef, contentRef, isFitted } = useSupplicationFit(supplication, compact);

  return (
    <div
      className={`supplication-screen flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden${
        compact ? ' supplication-screen--portrait' : ''
      }${supplication.compact ? ' supplication-screen--compact' : ''}`}
    >
      <div
        ref={containerRef}
        className={`supplication-screen__stack gpu-accelerated ${isFitted ? '' : 'opacity-0'}`}
      >
        <div ref={contentRef} className="supplication-screen__inner">
          <div className="supplication-screen__arabic-block">
            <p className="supplication-screen__arabic" dir="rtl" lang="ar">
              {supplication.arabicText}
            </p>
          </div>

          <div className="supplication-screen__divider" aria-hidden />

          <div className="supplication-screen__latin-block">
            <p className="supplication-screen__transliteration" dir="ltr" lang="en">
              {supplication.transliteration}
            </p>
            <p className="supplication-screen__translation" dir="ltr" lang="en">
              {supplication.translation}
            </p>
          </div>

          <p className="supplication-screen__reference">— {supplication.reference}</p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SupplicationScreen);
