import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';

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
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/cases', {
        title,
        fir_number: firNumber,
        case_type: caseType,
        priority,
        description,
        incident_location: incidentLocation
      });

      const newCaseId = res.data?.id;

      // Upload selected initial files if any
      if (newCaseId && files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('document_type', 'EVIDENCE');
          try {
            await api.post(`/cases/${newCaseId}/documents`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (e) {
            console.error('Initial document upload error:', e);
          }
        }
      }

      setSubmitting(false);
      onCaseCreated();
      onClose();
    } catch (err: any) {
      setSubmitting(false);
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create case. Ensure backend database is connected and fields are valid.';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'grid', placeItems: 'center', padding: '16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '540px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#172033' }}>Register New Investigation Case</h2>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: '#7b8494' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>CASE TITLE *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Operation Phantom Wire"
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#fff', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>FIR NUMBER</label>
              <input
                type="text"
                value={firNumber}
                onChange={e => setFirNumber(e.target.value)}
                placeholder="FIR-00891/2026"
                style={{ width: '100%', height: '40px', padding: '0 12px', background: '#fff', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>CASE TYPE</label>
              <select
                value={caseType}
                onChange={e => setCaseType(e.target.value)}
                style={{ width: '100%', height: '40px', padding: '0 12px', background: '#fff', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px' }}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>PRIORITY LEVEL</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={{ width: '100%', height: '40px', padding: '0 12px', background: '#fff', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px' }}
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>INCIDENT LOCATION</label>
              <input
                type="text"
                value={incidentLocation}
                onChange={e => setIncidentLocation(e.target.value)}
                placeholder="Metropolitan Office Hub"
                style={{ width: '100%', height: '40px', padding: '0 12px', background: '#fff', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>CASE DESCRIPTION / SYNOPSIS</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide executive case background..."
              style={{ width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px', outline: 0 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>INITIAL EVIDENCE FILES (FIR, BANK STATEMENTS, DIGITAL DUMPS)</label>
            <input
              type="file"
              multiple
              onChange={e => setFiles(Array.from(e.target.files || []))}
              style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
            />
            {files.length > 0 && (
              <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px', fontWeight: 600 }}>
                {files.length} file(s) attached: {files.map(f => f.name).join(', ')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
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
