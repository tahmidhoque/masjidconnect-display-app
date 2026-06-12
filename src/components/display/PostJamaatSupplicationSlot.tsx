/**
 * PostJamaatSupplicationSlot
 *
 * Cycles through the fixed post-Fardh duʿās during the post-jamaat
 * supplication window. Crossfade matches the content carousel.
 */

import React, { useEffect, useState } from 'react';
import { POST_JAMAAT_SUPPLICATIONS } from '@/constants/scheduledSupplications';
import SupplicationScreen from './SupplicationScreen';

/** Per-dua display time (ms). Longer than phones/jamaat slides — congregation needs time to read. */
const CYCLE_MS = 14_000;

/** Crossfade out duration (ms). Matches ContentCarousel. */
const FADE_OUT_MS = 700;

const PostJamaatSupplicationSlot: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    const swapTimers = new Set<ReturnType<typeof setTimeout>>();

    const tickId = setInterval(() => {
      setPhase('out');
      const swapId = setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % POST_JAMAAT_SUPPLICATIONS.length);
        setPhase('in');
        swapTimers.delete(swapId);
      }, FADE_OUT_MS);
      swapTimers.add(swapId);
    }, CYCLE_MS);

    return () => {
      clearInterval(tickId);
      swapTimers.forEach((id) => clearTimeout(id));
      swapTimers.clear();
    };
  }, []);

  const supplication = POST_JAMAAT_SUPPLICATIONS[activeIdx];

  return (
    <div
      key={supplication.id}
      className={`h-full w-full min-h-0 ${phase === 'in' ? 'animate-fade-in' : 'animate-fade-out'}`}
    >
      <SupplicationScreen supplication={supplication} />
    </div>
  );
};

export default React.memo(PostJamaatSupplicationSlot);
