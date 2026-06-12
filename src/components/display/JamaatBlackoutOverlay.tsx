/**
 * JamaatBlackoutOverlay
 *
 * Full logical-viewport black layer — simulates the display being switched off
 * while jamaat is in progress. Portalled into `#orientation-portal-root` so
 * rotation-aware coverage matches fullscreen media overlays.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function resolvePortalRoot(): HTMLElement {
  return document.getElementById('orientation-portal-root') ?? document.body;
}

const JamaatBlackoutOverlay: React.FC = () => {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(resolvePortalRoot());
  }, []);

  if (!portalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] bg-black pointer-events-none"
      aria-hidden
      data-testid="jamaat-blackout-overlay"
    />,
    portalRoot,
  );
};

export default React.memo(JamaatBlackoutOverlay);
