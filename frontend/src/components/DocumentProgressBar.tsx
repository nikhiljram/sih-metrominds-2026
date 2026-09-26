import React, { useEffect, useState } from 'react';
import api from '../api';
import styles from './DocumentProgressBar.module.css';

interface Stage {
  key: string;
  label: string;
  percent: number;
  state: 'done' | 'active' | 'pending' | 'failed';
}

interface ProgressInfo {
  percent: number;
  is_complete: boolean;
  is_failed: boolean;
  error?: string | null;
  stages: Stage[];
}

interface DocumentProgressBarProps {
  caseId: number;
  documentId: number;
  fileName: string;
}

export default function DocumentProgressBar({ caseId, documentId, fileName }: DocumentProgressBarProps) {
  const [progress, setProgress] = useState<ProgressInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await api.get(`/cases/${caseId}/documents/${documentId}/status`);
        if (!cancelled) setProgress(res.data);
      } catch (e) {
        console.error('Failed to fetch document status', e);
      }
    };

    fetchStatus();
    // Poll fast (every 1.5s) while incomplete
    const interval = setInterval(fetchStatus, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [caseId, documentId]);

  if (!progress) return null;

  return (
    <div className={styles.progressContainer}>
      <div className={styles.headerRow}>
        <span className={styles.fileName}>📄 {fileName}</span>
        <span className={styles.percentageText}>
          {progress.is_complete ? '100%' : `${progress.percent}%`}
        </span>
      </div>

      <div className={styles.barBackground}>
        <div
          className={`${styles.barFill} ${progress.is_complete ? styles.completeFill : ''}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className={styles.stagesGrid}>
        {progress.stages.map((stage) => {
          let badgeClass = styles.pendingBadge;
          let icon = '⚪';
          if (stage.state === 'done') {
            badgeClass = styles.doneBadge;
            icon = '✓';
          } else if (stage.state === 'active') {
            badgeClass = styles.activeBadge;
            icon = '⚡';
          } else if (stage.state === 'failed') {
            badgeClass = styles.failedBadge;
            icon = '✕';
          }

          return (
            <div key={stage.key} className={`${styles.stageChip} ${badgeClass}`}>
              <span className={styles.chipIcon}>{icon}</span>
              <span>{stage.label}</span>
            </div>
          );
        })}
      </div>

      {progress.is_complete && (
        <div className={styles.completeBanner}>
          ✨ AI Extraction Completed & Network Graph Linked
        </div>
      )}

      {progress.is_failed && (
        <div className={styles.failedBanner}>
          ⚠️ Processing Failed: {progress.error || 'Unknown Error'}
        </div>
      )}
    </div>
  );
}
