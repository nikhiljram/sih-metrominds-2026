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
  extracted_entities?: string[];
  relationship_count?: number;
}

interface DocumentProgressBarProps {
  caseId: number;
  documentId: number;
  fileName: string;
}

export default function DocumentProgressBar({ caseId, documentId, fileName }: DocumentProgressBarProps) {
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await api.get(`/cases/${caseId}/documents/${documentId}/status`);
        if (!cancelled) {
          setProgress(res.data);
          // Live process activity log for Google Chrome Console & Network Tab
          console.info(
            `%c[DOCUMENT PIPELINE] ${fileName} | Status: ${res.data.status} (${res.data.percent}%)`,
            'color: #2563eb; font-weight: 700; background: #eff6ff; padding: 2px 6px; border-radius: 4px;',
            {
              documentId,
              status: res.data.status,
              percent: res.data.percent,
              extractedEntities: res.data.extracted_entities || [],
              relationshipCount: res.data.relationship_count || 0,
              isComplete: res.data.is_complete,
              stages: res.data.stages,
            }
          );
        }
      } catch (e) {
        console.error('Failed to fetch document status', e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [caseId, documentId]);

  const handleReupload = async () => {
    setReprocessing(true);
    try {
      await api.post(`/cases/${caseId}/documents/${documentId}/process`);
    } catch (e) {
      console.error('Failed to trigger document re-processing', e);
    } finally {
      setTimeout(() => setReprocessing(false), 2000);
    }
  };

  if (!progress) return null;

  const isPendingOrStuck = !progress.is_complete && (!progress.extracted_entities || progress.extracted_entities.length === 0);

  return (
    <div className={styles.progressContainer}>
      <div className={styles.headerRow}>
        <span className={styles.fileName}>📄 {fileName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(isPendingOrStuck || progress.is_failed) && (
            <button
              onClick={handleReupload}
              disabled={reprocessing}
              className={styles.reuploadButton}
              title="Click to re-process and re-extract document entities"
            >
              {reprocessing ? '🔄 Starting...' : '🔄 Re-Process / Re-Upload'}
            </button>
          )}
          <span className={styles.percentageText}>
            {progress.is_complete ? '100%' : `${progress.percent}%`}
          </span>
        </div>
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

          let extraInfo = null;
          if (stage.key === 'ENTITY_EXTRACTING' && progress.extracted_entities && progress.extracted_entities.length > 0) {
            extraInfo = `: ${progress.extracted_entities.slice(0, 3).join(', ')}${progress.extracted_entities.length > 3 ? '...' : ''}`;
          } else if (stage.key === 'RELATIONSHIP_EXTRACTING' && typeof progress.relationship_count === 'number' && progress.relationship_count > 0) {
            extraInfo = `: ${progress.relationship_count} links`;
          }

          return (
            <div key={stage.key} className={`${styles.stageChip} ${badgeClass}`}>
              <span className={styles.chipIcon}>{icon}</span>
              <span>{stage.label}{extraInfo}</span>
            </div>
          );
        })}
      </div>

      {!progress.is_complete && (
        <div style={{ margin: '8px 0', fontSize: '12px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
          <strong>Live Stream Activity:</strong> {
            progress.status === 'EXTRACTING' ? 'Reading and parsing evidence file pages...' :
            progress.status === 'CHUNKING' ? 'Segmenting evidence content into vector chunks...' :
            progress.status === 'EMBEDDING' ? 'Generating 768-dim AI semantic embeddings...' :
            progress.status === 'ENTITY_EXTRACTING' ? `AI Streaming Entities (${(progress.extracted_entities || []).length} found): ${(progress.extracted_entities || []).join(', ') || 'Scanning proper names...'}` :
            progress.status === 'RELATIONSHIP_EXTRACTING' ? `Mapping Entity Links (${progress.relationship_count || 0} connections created)...` :
            'Processing document...'
          }
        </div>
      )}

      {progress.extracted_entities && progress.extracted_entities.length > 0 && (
        <div className={styles.entityTicker}>
          🔍 <strong>Extracted Entities Stream:</strong> {progress.extracted_entities.join(' • ')}
        </div>
      )}

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
