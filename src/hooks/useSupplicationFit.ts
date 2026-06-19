/**
 * useSupplicationFit
 *
 * Area-aware typography for scheduled supplication screens. Scales all text
 * to fit the content band exactly — no auto-scroll, no transform hacks.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import logger from '@/utils/logger';
import type { HardcodedSupplication } from '@/constants/scheduledSupplications';
import {
  applySupplicationFontSizeProps,
  computeSupplicationFontSizes,
  getScalingForSupplication,
} from '@/components/display/contentScaling';

const MAX_FIT_ITERATIONS = 10;
const FIT_RATIO = 0.94;
const HEADROOM_THRESHOLD = 0.78;
/** Lowest font multiplier the fit loop may use. */
const FIT_MIN_MULTIPLIER = 0.32;
/** Extra shave after proportional correction — headroom for harakat above scrollHeight. */
const HARAKAT_MARGIN = 0.96;

export interface UseSupplicationFitResult {
  containerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  isFitted: boolean;
}

function availableContentHeight(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const inner = el.clientHeight - padY;
  return inner > 0 ? inner * FIT_RATIO : 0;
}

export default function useSupplicationFit(
  supplication: HardcodedSupplication,
  compact = false,
): UseSupplicationFitResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fitLoopRafRef = useRef(0);

  const [isFitted, setIsFitted] = useState(false);

  const scalingResult = useMemo(
    () => getScalingForSupplication(supplication),
    [supplication],
  );

  useLayoutEffect(() => {
    const content = contentRef.current;
    setIsFitted(false);
    if (!content || !scalingResult) return;

    const { tier, config } = scalingResult;
    const initialSizes = computeSupplicationFontSizes(tier, config.baseMultiplier);
    applySupplicationFontSizeProps(content, initialSizes);
  }, [supplication.id, scalingResult]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content || !scalingResult) {
      setIsFitted(true);
      return;
    }

    let cancelled = false;

    const finishFit = (tier: ReturnType<typeof getScalingForSupplication>['tier'], multiplier: number) => {
      applySupplicationFontSizeProps(
        contentRef.current!,
        computeSupplicationFontSizes(tier, multiplier),
      );

      fitLoopRafRef.current = requestAnimationFrame(() => {
        if (cancelled || !containerRef.current || !contentRef.current) return;

        const availH = availableContentHeight(containerRef.current);
        const cnt = contentRef.current;
        const finalH = cnt.scrollHeight;
        let finalMultiplier = multiplier;

        if (finalH > availH && finalH > 0) {
          finalMultiplier = Math.max(
            FIT_MIN_MULTIPLIER,
            finalMultiplier * (availH / finalH) * HARAKAT_MARGIN,
          );
          applySupplicationFontSizeProps(
            cnt,
            computeSupplicationFontSizes(tier, finalMultiplier),
          );

          fitLoopRafRef.current = requestAnimationFrame(() => {
            if (cancelled) return;
            logger.debug('[Supplication] Proportional fit applied', {
              id: supplication.id,
              tier,
              multiplier: finalMultiplier,
            });
            setIsFitted(true);
          });
          return;
        }

        logger.debug('[Supplication] Fit found', {
          id: supplication.id,
          tier,
          multiplier: finalMultiplier,
        });
        setIsFitted(true);
      });
    };

    const runFitLoop = () => {
      if (cancelled || !containerRef.current || !contentRef.current) return;

      const ctr = containerRef.current;
      const cnt = contentRef.current;
      const availH = availableContentHeight(ctr);

      if (availH <= 0) {
        setIsFitted(true);
        return;
      }

      const { config, tier } = scalingResult;
      let lo = FIT_MIN_MULTIPLIER;
      let hi = config.maxMultiplier;
      let bestMultiplier = config.baseMultiplier;

      applySupplicationFontSizeProps(
        cnt,
        computeSupplicationFontSizes(tier, config.baseMultiplier),
      );

      fitLoopRafRef.current = requestAnimationFrame(() => {
        if (cancelled) return;

        const naturalH = cnt.scrollHeight;
        if (naturalH <= 0) {
          setIsFitted(true);
          return;
        }

        const fitsH = naturalH <= availH;

        if (fitsH) {
          const fillRatio = naturalH / availH;
          if (fillRatio < HEADROOM_THRESHOLD && config.baseMultiplier < config.maxMultiplier) {
            lo = config.baseMultiplier;
            hi = config.maxMultiplier;
          } else {
            finishFit(tier, config.baseMultiplier);
            return;
          }
        } else {
          lo = FIT_MIN_MULTIPLIER;
          hi = config.baseMultiplier;
        }

        let iterations = 0;
        const search = () => {
          if (cancelled || iterations >= MAX_FIT_ITERATIONS) {
            finishFit(tier, bestMultiplier);
            return;
          }

          const mid = (lo + hi) / 2;
          applySupplicationFontSizeProps(cnt, computeSupplicationFontSizes(tier, mid));

          fitLoopRafRef.current = requestAnimationFrame(() => {
            if (cancelled) return;

            const h = cnt.scrollHeight;
            if (h <= availH) {
              bestMultiplier = mid;
              lo = mid;
            } else {
              hi = mid;
            }

            iterations += 1;
            search();
          });
        };

        search();
      });
    };

    fitLoopRafRef.current = requestAnimationFrame(runFitLoop);

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(fitLoopRafRef.current);
      setIsFitted(false);
      fitLoopRafRef.current = requestAnimationFrame(runFitLoop);
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(fitLoopRafRef.current);
      observer.disconnect();
    };
  }, [compact, scalingResult, supplication.id]);

  return {
    containerRef,
    contentRef,
    isFitted,
  };
}
