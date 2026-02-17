/**
 * LoadingScreen
 *
 * Shown during app initialisation. Displays:
 *  - MasjidConnect logo/branding
 *  - Animated progress bar
 *  - Current loading task description
 *  - Subtle geometric background pattern
 *
 * GPU-safe: all animations use transform/opacity only.
 */

import React from 'react';
import type { LoadingTask } from '../../hooks/useAppLoader';
import { IslamicPattern } from '../display';

interface LoadingScreenProps {
  progress: number;
  message: string;
  tasks: LoadingTask[];
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, message, tasks }) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="fullscreen flex flex-col items-center justify-center bg-midnight relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none">
        <IslamicPattern opacity={0.03} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in">
        {/* Logo area */}
        <div className="flex flex-col items-center gap-3">
          {/* Star/crescent icon via CSS */}
          <div className="w-16 h-16 rounded-2xl bg-emerald/20 border border-emerald/30 flex items-center justify-center mb-2">
            <span className="text-3xl text-emerald">☪</span>
          </div>
          <h1 className="text-heading text-gold font-bold tracking-tight">MasjidConnect</h1>
          <p className="text-caption text-text-muted">Digital Display System</p>
        </div>

        {/* Progress bar */}
        <div className="w-72 flex flex-col gap-3">
          <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald transition-all duration-slow gpu-accelerated"
              style={{ width: `${clampedProgress}%` }}
            />
          </div>

          {/* Percentage */}
          <div className="flex items-center justify-between text-caption text-text-muted tabular-nums">
            <span>{message || 'Initialising…'}</span>
            <span>{Math.round(clampedProgress)}%</span>
          </div>
        </div>

        {/* Task list (small) */}
        <div className="flex flex-col gap-1.5 w-72">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-caption">
              {/* Status icon */}
              <span className="w-4 text-center">
                {task.status === 'complete' && <span className="text-alert-green">✓</span>}
                {task.status === 'loading' && <span className="text-emerald animate-subtle-pulse">●</span>}
                {task.status === 'error' && <span className="text-alert-red">✗</span>}
                {task.status === 'pending' && <span className="text-text-muted/40">○</span>}
                {task.status === 'skipped' && <span className="text-text-muted/40">—</span>}
              </span>
              <span className={task.status === 'complete' ? 'text-text-secondary' : task.status === 'loading' ? 'text-text-primary' : 'text-text-muted'}>
                {task.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
