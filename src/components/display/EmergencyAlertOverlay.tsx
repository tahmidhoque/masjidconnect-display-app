/**
 * EmergencyAlertOverlay
 *
 * Full-screen emergency alert takeover. Reads from emergencySlice and renders
 * three zones (header / body / footer) whose background colour, icon, and
 * animation intensity are derived from the `category` and `urgency` fields of
 * the v2 WebSocket payload.
 *
 * Lifecycle:
 *   mount → entry animation → visible → (timer expires) → exit animation → unmount
 *
 * The countdown is driven by `expiresAt`, not `timing.remaining`, to avoid
 * clock-skew drift.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Wrench,
  Landmark,
  CalendarClock,
  Megaphone,
  Pencil,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearCurrentAlert } from '@/store/slices/emergencySlice';
import type { RootState } from '@/store';
import type { AlertCategory, AlertUrgency, EmergencyAlert } from '@/api/models';
import { ORIENTATION_FORCE_EVENT } from '@/hooks/useDevKeyboard';
import type { RotationDegrees } from '@/types/realtime';
import logger from '@/utils/logger';

/* ------------------------------------------------------------------ */
/*  Colour helpers                                                     */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<AlertCategory, string> = {
  safety:    '#D32F2F',
  facility:  '#E65100',
  janazah:   '#263238',
  schedule:  '#1565C0',
  community: '#00695C',
  custom:    '#6A1B9A',
};

/** Resolve the solid background colour from the alert's category and color fields. */
function getAlertBackgroundColor(alert: EmergencyAlert): string {
  if (alert.category === 'custom' && alert.color) {
    return alert.color;
  }
  return CATEGORY_COLORS[alert.category] ?? '#263238';
}

/**
 * Choose white or black text based on the background luminance.
 * Used for custom-category alerts where the admin chooses the colour.
 */
function getTextColor(hexBg: string): '#ffffff' | '#000000' {
  try {
    const r = parseInt(hexBg.slice(1, 3), 16);
    const g = parseInt(hexBg.slice(3, 5), 16);
    const b = parseInt(hexBg.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#000000' : '#ffffff';
  } catch {
    return '#ffffff';
  }
}

/* ------------------------------------------------------------------ */
/*  Category metadata                                                  */
/* ------------------------------------------------------------------ */

interface CategoryMeta {
  icon: React.ReactNode;
  label: string;
  showCountdownInHeader: boolean;
}

function getCategoryMeta(category: AlertCategory): CategoryMeta {
  const iconClass = 'w-[1.8vw] h-[1.8vw] shrink-0';
  switch (category) {
    case 'safety':
      return {
        icon: <ShieldAlert className={iconClass} />,
        label: 'SAFETY ALERT',
        showCountdownInHeader: true,
      };
    case 'facility':
      return {
        icon: <Wrench className={iconClass} />,
        label: 'FACILITY NOTICE',
        showCountdownInHeader: true,
      };
    case 'janazah':
      return {
        icon: <Landmark className={iconClass} />,
        label: 'JANAZAH ANNOUNCEMENT',
        showCountdownInHeader: false, // Respectful — hide countdown in header for janazah
      };
    case 'schedule':
      return {
        icon: <CalendarClock className={iconClass} />,
        label: 'SCHEDULE CHANGE',
        showCountdownInHeader: true,
      };
    case 'community':
      return {
        icon: <Megaphone className={iconClass} />,
        label: 'ANNOUNCEMENT',
        showCountdownInHeader: true,
      };
    case 'custom':
      return {
        icon: <Pencil className={iconClass} />,
        label: 'ANNOUNCEMENT',
        showCountdownInHeader: true,
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Countdown helpers                                                  */
/* ------------------------------------------------------------------ */

function getRemainingMs(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Urgency CSS class                                                  */
/* ------------------------------------------------------------------ */

function getUrgencyClass(urgency: AlertUrgency): string {
  switch (urgency) {
    case 'critical': return 'emergency-overlay--critical';
    case 'high':     return 'emergency-overlay--high';
    case 'medium':   return 'emergency-overlay--medium';
  }
}

function getTitleWeight(urgency: AlertUrgency): number {
  switch (urgency) {
    case 'critical': return 800;
    case 'high':     return 700;
    case 'medium':   return 600;
  }
}

/* ------------------------------------------------------------------ */
/*  MasjidConnect wordmark (inline SVG, white)                        */
/* ------------------------------------------------------------------ */

const MasjidConnectWordmark: React.FC<{ opacity?: number }> = ({ opacity = 0.6 }) => (
  <span
    className="font-bold tracking-wide"
    style={{ opacity, fontSize: '1.1vw', letterSpacing: '0.05em' }}
  >
    MasjidConnect
  </span>
);

/* ------------------------------------------------------------------ */
/*  AlertContent — the three-zone layout                              */
/* ------------------------------------------------------------------ */

interface AlertContentProps {
  alert: EmergencyAlert;
  isExiting: boolean;
  remainingMs: number;
}

const AlertContent: React.FC<AlertContentProps> = ({ alert, isExiting, remainingMs }) => {
  const bgColor     = getAlertBackgroundColor(alert);
  const textColor   = getTextColor(bgColor);
  const urgencyClass = getUrgencyClass(alert.urgency);
  const meta        = getCategoryMeta(alert.category);
  const titleWeight = getTitleWeight(alert.urgency);

  const overlayClasses = [
    'emergency-overlay',
    urgencyClass,
    isExiting ? 'emergency-overlay--exiting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`${overlayClasses} gpu-accelerated`}
      style={{ backgroundColor: bgColor, color: textColor }}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* ---- HEADER ---- */}
      <div
        className="emergency-zone-tint flex items-center justify-between px-[5vw]"
        style={{ height: '12%', minHeight: 0 }}
      >
        {/* Left: icon + category label */}
        <div className="flex items-center gap-[1vw]">
          {meta.icon}
          <span className="emergency-category-label">{meta.label}</span>
        </div>

        {/* Right: countdown (hidden for janazah) */}
        {meta.showCountdownInHeader && (
          <span className="emergency-countdown">
            {formatCountdown(remainingMs)}
          </span>
        )}
      </div>

      {/* ---- BODY ---- */}
      <div
        className="flex flex-col items-center justify-center px-[5vw] text-center"
        style={{ flex: 1, minHeight: 0 }}
      >
        <h1
          className="emergency-title mb-[2vw]"
          style={{ fontWeight: titleWeight }}
        >
          {alert.title}
        </h1>

        <p
          className="emergency-message"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            maxWidth: '80vw',
          }}
        >
          {alert.message}
        </p>
      </div>

      {/* ---- FOOTER ---- */}
      <div
        className="emergency-zone-tint flex items-center px-[5vw]"
        style={{ height: '16%', minHeight: 0 }}
      >
        <MasjidConnectWordmark />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  EmergencyAlertOverlay — mount / unmount lifecycle                 */
/* ------------------------------------------------------------------ */

const FADE_OUT_MS = 400; // must match emergency-exit animation duration

const EmergencyAlertOverlay: React.FC = () => {
  const dispatch = useAppDispatch();
  const alert = useAppSelector((s: RootState) => s.emergency.currentAlert);

  /* Dev-mode orientation override */
  const [orientationOverride, setOrientationOverride] = useState<
    'LANDSCAPE' | 'PORTRAIT' | undefined
  >(() => window.__ORIENTATION_FORCE);

  useEffect(() => {
    const handler = () => setOrientationOverride(window.__ORIENTATION_FORCE);
    window.addEventListener(ORIENTATION_FORCE_EVENT, handler);
    return () => window.removeEventListener(ORIENTATION_FORCE_EVENT, handler);
  }, []);

  const uiRotationDegrees = useAppSelector((s: RootState) => s.ui.rotationDegrees);
  const rotationDegrees: RotationDegrees =
    orientationOverride !== undefined
      ? orientationOverride === 'PORTRAIT'
        ? 90
        : 0
      : uiRotationDegrees;

  /* Animation states: mount → entering → visible → exiting → unmount */
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  /* Keep the last non-null alert data for the exit animation render */
  const alertDataRef = useRef<EmergencyAlert | null>(null);
  if (alert) alertDataRef.current = alert;

  /* Countdown state — updated every second */
  const [remainingMs, setRemainingMs] = useState(0);

  /* Timers */
  const expiryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (expiryTimerRef.current)  { clearTimeout(expiryTimerRef.current);   expiryTimerRef.current  = null; }
    if (fadeTimerRef.current)    { clearTimeout(fadeTimerRef.current);      fadeTimerRef.current    = null; }
    if (countdownRef.current)    { clearInterval(countdownRef.current);     countdownRef.current    = null; }
  }, []);

  const startExitSequence = useCallback(() => {
    setIsExiting(true);
    fadeTimerRef.current = setTimeout(() => {
      setMounted(false);
      setIsExiting(false);
    }, FADE_OUT_MS);
  }, []);

  useEffect(() => {
    if (alert) {
      clearAllTimers();
      setIsExiting(false);

      const ms = getRemainingMs(alert.expiresAt);
      if (ms <= 0) {
        // Already expired at receipt time — dismiss immediately
        logger.debug('[EmergencyOverlay] Alert already expired, dismissing');
        dispatch(clearCurrentAlert());
        return;
      }

      setRemainingMs(ms);
      setMounted(true);

      // Countdown tick every second
      countdownRef.current = setInterval(() => {
        setRemainingMs(getRemainingMs(alert.expiresAt));
      }, 1_000);

      // Schedule expiry (400ms early to trigger fade before clearing Redux)
      expiryTimerRef.current = setTimeout(() => {
        startExitSequence();
        // Give the exit animation time to finish before clearing Redux state
        setTimeout(() => {
          dispatch(clearCurrentAlert());
        }, FADE_OUT_MS);
      }, Math.max(0, ms - FADE_OUT_MS));

      logger.info('[EmergencyOverlay] Alert mounted', {
        id: alert.id,
        category: alert.category,
        urgency: alert.urgency,
        expiresIn: `${Math.round(ms / 1000)}s`,
      });
    } else if (!isExiting) {
      // Alert cleared externally (e.g. action === "clear") — trigger exit
      if (mounted) {
        startExitSequence();
      }
    }

    return clearAllTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  if (!mounted) return null;

  const displayAlert = alertDataRef.current;
  if (!displayAlert) return null;

  const content = (
    <AlertContent
      alert={displayAlert}
      isExiting={isExiting}
      remainingMs={remainingMs}
    />
  );

  if (rotationDegrees !== 0) {
    const swapDimensions = rotationDegrees === 90 || rotationDegrees === 270;
    return (
      <div
        className="fixed inset-0 gpu-accelerated"
        style={{
          zIndex: 9999,
          top: '50%',
          left: '50%',
          width: swapDimensions ? '100vh' : '100vw',
          height: swapDimensions ? '100vw' : '100vh',
          transform: `translate(-50%, -50%) rotate(${rotationDegrees}deg)`,
          transformOrigin: 'center center',
          overflow: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        {content}
      </div>
    );
  }

  return content;
};

export default EmergencyAlertOverlay;
