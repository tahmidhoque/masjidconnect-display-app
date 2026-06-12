/**
 * SupplicationScreen
 *
 * Full content-band display for a fixed congregational supplication
 * (Arabic, transliteration, translation). Centred Arabic block with
 * grouped Latin text below — legible from distance on mosque signage.
 */

import React from 'react';
import type { HardcodedSupplication } from '@/constants/scheduledSupplications';

export interface SupplicationScreenProps {
  supplication: HardcodedSupplication;
}

const SupplicationScreen: React.FC<SupplicationScreenProps> = ({ supplication }) => (
  <div
    className={`supplication-screen flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden${
      supplication.compact ? ' supplication-screen--compact' : ''
    }`}
  >
    <div className="supplication-screen__stack">
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
);

export default React.memo(SupplicationScreen);
