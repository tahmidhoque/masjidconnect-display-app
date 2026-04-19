/**
 * WifiSettingsOverlay
 *
 * Full-screen, keyboard-navigable settings overlay. Triggered by Ctrl+Shift+W.
 *
 * Two presentations depending on `isPiPlatform`:
 *   - On the Pi kiosk — shows WiFi management (current connection, scan list,
 *     saved profiles) plus the Sound section. WiFi calls hit the deploy
 *     server's /internal/wifi/* endpoints which only exist on the Pi.
 *   - Anywhere else (Vercel preview, browser dev, Android TV WebView) — only
 *     the Sound section is shown, because the WiFi controls would be
 *     non-functional and confusing. The header title and icon adapt
 *     accordingly.
 *
 * Keyboard model (designed for keyboard-only kiosk use, no mouse required):
 *   - ArrowUp / ArrowDown — move focus through every interactive control in
 *     DOM order, wrapping at the ends. The newly focused element is scrolled
 *     into view automatically.
 *   - Enter / Space — activate the focused button or toggle.
 *   - ArrowLeft / ArrowRight — adjust the volume slider when it is focused
 *     (native range-input behaviour).
 *   - Escape — close the overlay.
 *
 * z-index: 9998 (below EmergencyAlertOverlay at 9999, above everything else).
 * Cursor is set to auto within the overlay (exception to global cursor:none).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Trash2, X, Lock, Signal, Check, Loader2, Bell, BellOff, Volume2, VolumeX, Play, Settings } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectShowWifiSettings,
  selectWifiStatus,
  setShowWifiSettings,
} from '../../store/slices/uiSlice';
import { useBuzzerSettings } from '../../hooks/useBuzzerSettings';
import { playBuzzerPreview } from '../../hooks/useJamaatBuzzer';
import { isPiPlatform } from '../../config/platform';
import logger from '../../utils/logger';

interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
  frequency: string;
}

interface SavedProfile {
  name: string;
  autoconnect: boolean;
}

const WifiSettingsOverlay: React.FC = () => {
  const dispatch = useAppDispatch();
  const isVisible = useAppSelector(selectShowWifiSettings);
  const wifiStatus = useAppSelector(selectWifiStatus);

  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  /* Jamaat buzzer settings (device-local, persisted to localStorage) */
  const { enabled: buzzerEnabled, volume: buzzerVolume, setEnabled: setBuzzerEnabled, setVolume: setBuzzerVolume } = useBuzzerSettings();
  const [isTestingSound, setIsTestingSound] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    dispatch(setShowWifiSettings(false));
    setSelectedNetwork(null);
    setPassword('');
    setStatusMsg(null);
  }, [dispatch]);

  // Escape to close
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [isVisible, close]);

  /**
   * Arrow-key roving focus.
   *
   * ArrowUp / ArrowDown move focus to the previous / next focusable control
   * within the dialog (wraps). This lets a keyboard-only user reach every
   * setting without a mouse or Tab key. The slider keeps its native
   * Left/Right behaviour for value adjustment because we only intercept
   * vertical arrows.
   */
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')
      );
      if (focusables.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const currentIdx = active ? focusables.indexOf(active) : -1;

      const lastIdx = focusables.length - 1;
      const nextIdx =
        e.key === 'ArrowDown'
          ? currentIdx < 0 ? 0 : (currentIdx + 1) % focusables.length
          : currentIdx <= 0 ? lastIdx : currentIdx - 1;

      e.preventDefault();
      e.stopPropagation();
      const next = focusables[nextIdx];
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [isVisible]);

  // Focus management — land on the close button when the overlay opens so
  // ArrowDown immediately starts walking through the controls.
  useEffect(() => {
    if (isVisible) closeRef.current?.focus();
  }, [isVisible]);

  // Scan for networks
  const scan = useCallback(async () => {
    setIsScanning(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/internal/wifi/scan', { signal: AbortSignal.timeout(15_000) });
      const data = await res.json();
      setNetworks(data.networks || []);
      setStatusMsg({ type: 'info', text: `Found ${(data.networks || []).length} network(s)` });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Scan failed — check WiFi adapter' });
      logger.error('[WifiOverlay] Scan failed', { error: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Load saved profiles
  const loadSaved = useCallback(async () => {
    try {
      const res = await fetch('/internal/wifi/saved', { signal: AbortSignal.timeout(5_000) });
      const data = await res.json();
      setSavedProfiles(data.profiles || []);
    } catch (e) {
      logger.debug('[WifiOverlay] saved profiles unavailable', { error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  // Auto-scan and load on open — only on the Pi where /internal/wifi/* exists.
  useEffect(() => {
    if (isVisible && isPiPlatform) {
      scan();
      loadSaved();
    }
  }, [isVisible, scan, loadSaved]);

  // Connect to network
  const connect = useCallback(async () => {
    if (!selectedNetwork) return;
    setIsConnecting(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/internal/wifi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: selectedNetwork.ssid,
          password,
          security: selectedNetwork.security,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Connected to ${selectedNetwork.ssid}` });
        setSelectedNetwork(null);
        setPassword('');
        loadSaved();
        logger.info('[WifiOverlay] Connected', { ssid: selectedNetwork.ssid });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Connection failed' });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Connection request failed' });
      logger.error('[WifiOverlay] Connect failed', { error: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsConnecting(false);
    }
  }, [selectedNetwork, password, loadSaved]);

  // Forget a saved profile
  const forget = useCallback(async (name: string) => {
    try {
      const res = await fetch('/internal/wifi/forget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'info', text: `Forgot ${name}` });
        loadSaved();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Could not forget network' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Request failed' });
    }
  }, [loadSaved]);

  /* Play the buzzer at the current volume so users can verify speakers/level. */
  const testBuzzer = useCallback(async () => {
    setIsTestingSound(true);
    try {
      await playBuzzerPreview(buzzerVolume);
    } catch (e) {
      logger.warn('[Settings] Buzzer test failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      setStatusMsg({ type: 'error', text: 'Could not play sound — check audio output' });
    } finally {
      /* Re-enable shortly so users can re-test without a hard wait. */
      setTimeout(() => setIsTestingSound(false), 800);
    }
  }, [buzzerVolume]);

  if (!isVisible) return null;

  const hasPassword = selectedNetwork?.security && selectedNetwork.security !== '' && selectedNetwork.security !== '--';
  const buzzerVolumePct = Math.round(buzzerVolume * 100);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80"
      style={{ cursor: 'auto' }}
      role="dialog"
      aria-modal="true"
      aria-label={isPiPlatform ? 'WiFi & Sound Settings' : 'Sound Settings'}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {isPiPlatform ? (
              <Wifi className="w-5 h-5 text-gold" />
            ) : (
              <Settings className="w-5 h-5 text-gold" />
            )}
            <h2 className="text-lg font-bold text-white">
              {isPiPlatform ? 'WiFi & Sound' : 'Settings'}
            </h2>
          </div>
          <button
            ref={closeRef}
            onClick={close}
            className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current WiFi status — Pi only (endpoint does not exist on hosted builds) */}
        {isPiPlatform && (
          <div className="px-6 py-3 bg-white/[0.02] border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${wifiStatus?.state === 'connected' ? 'bg-alert-green' : 'bg-alert-red'}`} />
              <div className="min-w-0">
                <span className="text-sm font-medium text-text-primary">
                  {wifiStatus?.state === 'connected'
                    ? `Connected to ${wifiStatus.ssid}`
                    : wifiStatus?.state === 'no-adapter'
                      ? 'No WiFi adapter'
                      : 'Disconnected'}
                </span>
                {wifiStatus?.state === 'connected' && (
                  <span className="text-xs text-text-muted ml-3">
                    Signal: {wifiStatus.signal}% · IP: {wifiStatus.ip}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status message */}
        {statusMsg && (
          <div className={`px-6 py-2 text-sm font-medium ${
            statusMsg.type === 'success' ? 'bg-alert-green/10 text-alert-green' :
            statusMsg.type === 'error' ? 'bg-alert-red/10 text-alert-red' :
            'bg-[#3b82f6]/10 text-[#93c5fd]'
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* Network list + password — Pi only */}
        {isPiPlatform && (
        <div className="px-6 py-4 max-h-[40vh] overflow-y-auto" style={{ cursor: 'auto' }}>
          {/* Scan header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              Available Networks
            </span>
            <button
              onClick={scan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded text-xs font-semibold text-gold hover:text-gold/80 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning…' : 'Rescan'}
            </button>
          </div>

          {/* Network list */}
          {networks.length === 0 && !isScanning && (
            <p className="text-sm text-text-muted py-4 text-center">No networks found</p>
          )}
          {isScanning && networks.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Scanning for networks…</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {networks.map((net) => {
              const isSelected = selectedNetwork?.ssid === net.ssid;
              const isCurrentlyConnected = wifiStatus?.state === 'connected' && wifiStatus.ssid === net.ssid;

              return (
                <div key={net.ssid}>
                  <button
                    onClick={() => {
                      setSelectedNetwork(isSelected ? null : net);
                      setPassword('');
                      setStatusMsg(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/70 ${
                      isSelected ? 'bg-gold/10 border border-gold/30' : 'hover:bg-white/5'
                    }`}
                  >
                    <SignalIcon signal={net.signal} />
                    <span className="flex-1 text-sm font-medium text-text-primary truncate">
                      {net.ssid}
                    </span>
                    {net.security && net.security !== '' && net.security !== '--' && (
                      <Lock className="w-3.5 h-3.5 text-text-muted" />
                    )}
                    {isCurrentlyConnected && (
                      <Check className="w-4 h-4 text-alert-green" />
                    )}
                    <span className="text-xs text-text-muted tabular-nums">{net.signal}%</span>
                  </button>

                  {/* Password entry (when selected & secured) */}
                  {isSelected && hasPassword && (
                    <div className="flex items-center gap-2 px-3 py-2 ml-7">
                      <input
                        ref={passwordRef}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') connect(); }}
                        placeholder="Enter password"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-gold/50 focus-visible:ring-2 focus-visible:ring-gold/70"
                        autoFocus
                        style={{ cursor: 'text' }}
                      />
                      <button
                        onClick={connect}
                        disabled={isConnecting}
                        className="px-4 py-2 bg-gold/20 text-gold font-semibold text-sm rounded-lg hover:bg-gold/30 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
                      >
                        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                      </button>
                    </div>
                  )}

                  {/* Open network: connect button */}
                  {isSelected && !hasPassword && (
                    <div className="flex items-center gap-2 px-3 py-2 ml-7">
                      <button
                        onClick={connect}
                        disabled={isConnecting}
                        className="px-4 py-2 bg-gold/20 text-gold font-semibold text-sm rounded-lg hover:bg-gold/30 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
                      >
                        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        )}

        {/* Saved profiles — Pi only */}
        {isPiPlatform && savedProfiles.length > 0 && (
          <div className="px-6 py-3 border-t border-white/5">
            <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
              Saved Networks
            </span>
            <div className="flex flex-col gap-1">
              {savedProfiles.map((profile) => (
                <div key={profile.name} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5">
                  <span className="text-sm text-text-primary">{profile.name}</span>
                  <button
                    onClick={() => forget(profile.name)}
                    className="flex items-center gap-1 px-2 py-1 -mx-2 -my-1 rounded text-xs text-alert-red/70 hover:text-alert-red transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-alert-red/60"
                    aria-label={`Forget ${profile.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Forget</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sound — jamaat buzzer settings (device-local) */}
        <div className="px-6 py-4 border-t border-white/10">
          <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 block">
            Sound
          </span>

          {/* Enable / disable toggle */}
          <button
            onClick={() => setBuzzerEnabled(!buzzerEnabled)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/70"
            aria-pressed={buzzerEnabled}
            aria-label={`Jamaat buzzer ${buzzerEnabled ? 'enabled' : 'disabled'}`}
          >
            {buzzerEnabled ? (
              <Bell className="w-4 h-4 text-gold shrink-0" />
            ) : (
              <BellOff className="w-4 h-4 text-text-muted shrink-0" />
            )}
            <span className="flex-1 text-sm font-medium text-text-primary">
              Jamaat buzzer
            </span>
            <span className="text-xs text-text-muted">
              {buzzerEnabled ? 'On' : 'Off'}
            </span>
            <span
              className={`relative w-9 h-5 rounded-full transition-colors ${
                buzzerEnabled ? 'bg-gold/60' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  buzzerEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          {/* Volume + test (disabled visuals when buzzer is off) */}
          <div className={`mt-2 px-3 py-2 ${buzzerEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex items-center gap-3">
              {buzzerVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-text-muted shrink-0" />
              ) : (
                <Volume2 className="w-4 h-4 text-text-secondary shrink-0" />
              )}
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={buzzerVolumePct}
                onChange={(e) => setBuzzerVolume(Number(e.target.value) / 100)}
                aria-label="Buzzer volume"
                className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-gold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1729]"
                style={{ cursor: 'pointer' }}
                disabled={!buzzerEnabled}
              />
              <span className="text-xs text-text-muted tabular-nums w-10 text-right">
                {buzzerVolumePct}%
              </span>
              <button
                onClick={testBuzzer}
                disabled={!buzzerEnabled || isTestingSound}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/20 text-gold text-xs font-semibold rounded-lg hover:bg-gold/30 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
                aria-label="Test buzzer sound"
              >
                {isTestingSound ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Test
              </button>
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              Plays once when each jamaat begins. Stored on this device only.
            </p>
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02]">
          <p className="text-[11px] text-text-muted text-center flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-text-secondary font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-text-secondary font-mono text-[10px]">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-text-secondary font-mono text-[10px]">Enter</kbd>
              select
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-text-secondary font-mono text-[10px]">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-text-secondary font-mono text-[10px]">→</kbd>
              adjust volume
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-text-secondary font-mono text-[10px]">Esc</kbd>
              close
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

/** Signal strength icon with visual indicator */
const SignalIcon: React.FC<{ signal: number }> = ({ signal }) => {
  if (signal >= 60) return <Signal className="w-4 h-4 text-alert-green" />;
  if (signal >= 30) return <Signal className="w-4 h-4 text-alert-orange" />;
  if (signal > 0) return <Signal className="w-4 h-4 text-alert-red" />;
  return <WifiOff className="w-4 h-4 text-text-muted" />;
};

export default React.memo(WifiSettingsOverlay);
