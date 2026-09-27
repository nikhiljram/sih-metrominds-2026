import React, { useState } from 'react';
import DocumentProgressBar from './DocumentProgressBar';
import { X } from 'lucide-react';
import api from '../api';
import styles from './CreateCaseModal.module.css';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: () => void;
}

export default function CreateCaseModal({ isOpen, onClose, onCaseCreated }: CreateCaseModalProps) {
  const [title, setTitle] = useState('');
  const [firNumber, setFirNumber] = useState('');
  const [caseType, setCaseType] = useState('FRAUD');
  const [priority, setPriority] = useState('HIGH');
  const [description, setDescription] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  // Track uploaded document IDs for progress display
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ id: number; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdCaseId, setCreatedCaseId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setUploadedDocs([]);
    try {
      const res = await api.post('/cases', {
        title,
        fir_number: firNumber,
        case_type: caseType,
        priority,
        description,
        incident_location: incidentLocation,
      });
      const newCaseId = res.data?.id;
      setCreatedCaseId(newCaseId);
      if (newCaseId && files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('document_type', 'EVIDENCE');
          try {
            const uploadRes = await api.post(`/cases/${newCaseId}/documents`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            const docId = uploadRes.data?.id;
            if (docId) {
              setUploadedDocs(prev => [...prev, { id: docId, name: file.name }]);
            }
          } catch (e) {
            console.error('Initial document upload error:', e);
          }
        }
        // Allow user to view progress bar reaching 100% completion in under 1 minute
        await new Promise(resolve => setTimeout(resolve, 3500));
      }
      setSubmitting(false);
      onCaseCreated();
    } catch (err: any) {
      setSubmitting(false);
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create case. Ensure backend database is connected and fields are valid.';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Register New Investigation Case</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label className={styles.label}>CASE TITLE *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Operation Phantom Wire"
              className={styles.input}
            />
          </div>
          <div className={styles.fieldContainer}>
            <div>
              <label className={styles.label}>FIR NUMBER</label>
              <input
                type="text"
                value={firNumber}
                onChange={e => setFirNumber(e.target.value)}
                placeholder="FIR-00891/2026"
                className={styles.input}
              />
            </div>
            <div>
              <label className={styles.label}>CASE TYPE</label>
              <select
                value={caseType}
                onChange={e => setCaseType(e.target.value)}
                className={styles.select}
              >
                <option value="FRAUD">Financial Fraud</option>
                <option value="CYBERCRIME">Cybercrime</option>
                <option value="NARCOTICS">Narcotics</option>
                <option value="ROBBERY">Organized Crime / Robbery</option>
                <option value="THEFT">Theft</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className={styles.fieldContainer}>
            <div>
              <label className={styles.label}>PRIORITY LEVEL</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className={styles.select}
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>
            <div>
              <label className={styles.label}>INCIDENT LOCATION</label>
              <input
                type="text"
                value={incidentLocation}
                onChange={e => setIncidentLocation(e.target.value)}
                placeholder="Metropolitan Office Hub"
                className={styles.input}
              />
            </div>
          </div>
          <div>
            <label className={styles.label}>CASE DESCRIPTION / SYNOPSIS</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide executive case background..."
              className={styles.textarea}
            />
          </div>
          <div>
            <label className={styles.label}>INITIAL EVIDENCE FILES (FIR, BANK STATEMENTS, DIGITAL DUMPS)</label>
            <input
              type="file"
              multiple
              onChange={e => setFiles(Array.from(e.target.files || []))}
              className={styles.fileInput}
            />
            {files.length > 0 && (
              <div className={styles.fileInfo}>
                {files.length} file(s) attached: {files.map(f => f.name).join(', ')}
              </div>
            )}
            {createdCaseId && uploadedDocs.map(doc => (
              <DocumentProgressBar
                key={doc.id}
                caseId={createdCaseId}
                documentId={doc.id}
                fileName={doc.name}
              />
            ))}
          </div>
          <div className={styles.buttonContainer}>
            <button type="button" onClick={onClose} className="secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="primary">
              {submitting ? 'Registering & Uploading...' : 'Register Case Dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
