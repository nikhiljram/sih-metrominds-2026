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
    // Initial fetch
    fetchStatus();
    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [caseId, documentId]);

  if (!progress) return null;

  return (
    <div className={styles.progressContainer}>
      <div className={styles.step}>Processing "{fileName}"</div>
      <div className={styles.barBackground}>
        <div
          className={styles.barFill}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
        {progress.is_complete
          ? 'Completed'
          : progress.is_failed
          ? `Failed: ${progress.error}`
          : `Progress: ${progress.percent}%`}
      </div>
      <ul style={{ marginTop: '8px', paddingLeft: '16px' }}>
        {progress.stages.map((stage) => (
          <li key={stage.key} style={{ marginBottom: '4px' }}>
            {stage.label} – {stage.state}
          </li>
        ))}
      </ul>
    </div>
  );
}
