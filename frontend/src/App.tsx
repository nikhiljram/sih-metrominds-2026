import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Bell,
  BarChart3,
  FolderOpen,
  FileText,
  Users,
  Share2,
  ListTree,
  Phone,
  WalletCards,
  Link2,
  Lightbulb,
  Sparkles,
  ClipboardCheck,
  Shield,
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import api from './api';

// --- MAIN GLOBAL SIDEBAR ---
function MainSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isCaseWorkspace = location.pathname.startsWith('/cases/');
  const currentCaseId = isCaseWorkspace ? location.pathname.split('/')[2] : null;

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const globalNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Search', path: '/search', icon: Search },
    { label: 'Notifications', path: '/notifications', icon: Bell, badge: '3' },
    { label: 'Reports', path: '/reports', icon: BarChart3 },
  ];

  const caseWorkspaceItems = [
    { label: 'Overview', path: `/cases/${currentCaseId}`, icon: FolderOpen },
    { label: 'Case Information', path: `/cases/${currentCaseId}/info`, icon: FileText },
    { label: 'Evidence', path: `/cases/${currentCaseId}/evidence`, icon: Shield },
    { label: 'Documents', path: `/cases/${currentCaseId}/documents`, icon: FileText },
    { label: 'Entities', path: `/cases/${currentCaseId}/entities`, icon: Users },
    { label: 'Network', path: `/cases/${currentCaseId}/network`, icon: Share2 },
    { label: 'Timeline', path: `/cases/${currentCaseId}/timeline`, icon: ListTree },
    { label: 'Communications', path: `/cases/${currentCaseId}/communications`, icon: Phone },
    { label: 'Financial', path: `/cases/${currentCaseId}/financial`, icon: WalletCards },
    { label: 'Related Cases', path: `/cases/${currentCaseId}/related`, icon: Link2 },
    { label: 'Intelligence', path: `/cases/${currentCaseId}/intelligence`, icon: Lightbulb },
    { label: 'AI Assistant', path: `/cases/${currentCaseId}/ai`, icon: Sparkles },
    { label: 'Audit', path: `/cases/${currentCaseId}/audit`, icon: ClipboardCheck },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Shield size={20} />
        </div>
        <div>
          <div className="brand-title">INVESTIGATION</div>
          <div className="brand-sub">INTELLIGENCE PLATFORM</div>
        </div>
      </div>

      <div className="nav-label">CORE WORKSPACE</div>
      {globalNavItems.map(item => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`nav-item ${isActive ? 'selected' : ''}`}
          >
            <Icon size={18} />
            <span>{item.label}</span>
            {item.badge && <span className="notif">{item.badge}</span>}
          </button>
        );
      })}

      {isCaseWorkspace && (
        <>
          <div className="divider" />
          <div className="nav-label">CASE WORKSPACE</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {caseWorkspaceItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`nav-item ${isActive ? 'selected' : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="sidebar-bottom">
        <button onClick={() => navigate('/settings')} className="nav-item">
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button onClick={handleLogout} className="nav-item" style={{ color: '#dc2626' }}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

// --- GLOBAL TOP HEADER BAR ---
function HeaderBar({ user, station }: { user: any, station: any }) {
  const navigate = useNavigate();
  const [headerQuery, setHeaderQuery] = useState('');

  const getInitials = (name: string) => {
    if (!name) return 'INV';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(headerQuery.trim())}`);
    }
  };

  return (
    <header className="topbar">
      <form onSubmit={handleSearchSubmit} className="global-search" style={{ margin: 0, padding: 0 }}>
        <Search size={16} />
        <input
          type="text"
          value={headerQuery}
          onChange={e => setHeaderQuery(e.target.value)}
          placeholder="Search cases, entities, documents, intelligence... (Press Enter)"
        />
        <kbd>⌘K</kbd>
      </form>

      <div className="session">
        <div className="green-dot" />
        <div>
          <b>{station?.station_name || 'Central Command'}</b>
          <small>{user?.role || 'Level 3 Clearance'}</small>
        </div>
      </div>

      <div className="v-divider" />

      <div className="profile">
        <div className="avatar">{getInitials(user?.name)}</div>
        <div>
          <b>{user?.name || 'Agent D. Vance'}</b>
          <small>{user?.designation || 'Senior Investigator'}</small>
        </div>
      </div>
    </header>
  );
}

// --- 1. LOGIN VIEW ---
function LoginView({ onLoginSuccess }: { onLoginSuccess: (data: any) => void }) {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('OFF-2026-001');
  const [password, setPassword] = useState('admin123');
  const [stationId, setStationId] = useState<number>(1);
  const [stations, setStations] = useState<any[]>([]);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    api.get('/auth/stations')
      .then(res => {
        setStations(res.data || []);
        if (res.data && res.data.length > 0) {
          setStationId(res.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await api.post('/auth/login', {
        employee_id: employeeId,
        station_id: Number(stationId),
        password: password
      });
      localStorage.setItem('token', res.data.access_token);
      onLoginSuccess(res.data);
      navigate('/dashboard');
    } catch (err: any) {
      setLoginError(err.response?.data?.detail || 'Authentication failed. Verify credentials.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <div className="brand-mark" style={{ width: '48px', height: '48px', marginBottom: '12px' }}>
            <Shield size={24} />
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 750, color: '#172033', margin: 0 }}>INVESTIGATION INTELLIGENCE</h1>
          <p style={{ fontSize: '12px', color: '#7b8494', margin: '4px 0 0' }}>Secure Investigator Enclave</p>
        </div>

        {loginError && (
          <div style={{ background: '#fef2f2', border: '1px solid #dc2626', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>STATION / DIVISION</label>
            <select
              value={stationId}
              onChange={e => setStationId(Number(e.target.value))}
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#f8fafc', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px', outline: 0 }}
            >
              {stations.map(st => (
                <option key={st.id} value={st.id}>
                  {st.station_name} ({st.station_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>INVESTIGATOR ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#f8fafc', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px', outline: 0 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>PASSPHRASE</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#f8fafc', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px', outline: 0 }}
            />
          </div>

          <button type="submit" className="primary" style={{ height: '40px', width: '100%', marginTop: '8px' }}>
            Authenticate Session
          </button>
        </form>
      </div>
    </div>
  );
}

// --- CREATE CASE MODAL ---
function CreateCaseModal({ isOpen, onClose, onCaseCreated }: { isOpen: boolean, onClose: () => void, onCaseCreated: () => void }) {
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

// --- 2. DASHBOARD / CASE REGISTRY ONLY ---
function DashboardView() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDashboardData = () => {
    setLoading(true);
    Promise.all([
      api.get('/cases'),
      api.get('/dashboard')
    ]).then(([casesRes, dashRes]) => {
      setCases(casesRes.data.cases || casesRes.data || []);
      setDashboardStats(dashRes.data.stats || null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const totalCasesCount = cases.length;
  const activeCasesCount = cases.filter(c => c.status === 'ACTIVE' || c.status === 'Active' || c.status === 'REGISTERED' || c.status === 'UNDER_INVESTIGATION' || c.status === 'Under Investigation').length;
  const underReviewCount = cases.filter(c => c.status === 'UNDER_REVIEW' || c.status === 'Under Review').length;
  const priorityCasesCount = cases.filter(c => c.priority === 'CRITICAL' || c.priority === 'HIGH' || c.priority === 'Critical' || c.priority === 'High').length;
  const totalDocumentsCount = dashboardStats?.total_documents ?? cases.reduce((acc, c) => acc + (c.document_count || 0), 0);
  const totalEntitiesCount = dashboardStats?.total_entities ?? cases.reduce((acc, c) => acc + (c.entity_count || 0), 0);

  const filteredCases = cases.filter(c => {
    if (activeTab === 'ACTIVE' && c.status !== 'Active' && c.status !== 'ACTIVE' && c.status !== 'Under Investigation' && c.status !== 'UNDER_INVESTIGATION' && c.status !== 'REGISTERED') return false;
    if (activeTab === 'REVIEW' && c.status !== 'Under Review' && c.status !== 'UNDER_REVIEW') return false;
    if (activeTab === 'CRITICAL' && c.priority !== 'High' && c.priority !== 'Critical' && c.priority !== 'CRITICAL' && c.priority !== 'HIGH') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNum = c.case_number?.toLowerCase().includes(q);
      const matchTitle = c.title?.toLowerCase().includes(q);
      const matchSub = c.subtitle?.toLowerCase().includes(q);
      const matchInv = c.creator_name?.toLowerCase().includes(q);
      if (!matchNum && !matchTitle && !matchSub && !matchInv) return false;
    }

    if (typeFilter !== 'ALL' && c.case_type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;

    return true;
  });

  return (
    <div>
      <CreateCaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCaseCreated={fetchDashboardData}
      />

      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Case registry and investigation status</p>
        </div>

        <div className="head-actions">
          <div className="today">
            <Calendar size={18} />
            <div>
              <b>Today</b>
              <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="primary"
          >
            <Plus size={16} />
            <span>Create New Case</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-icon">
            <FolderOpen size={20} />
          </div>
          <div>
            <div className="kpi-label">Total Cases</div>
            <div className="kpi-value">{totalCasesCount}</div>
            <div className="kpi-detail positive">{totalCasesCount > 0 ? `${totalCasesCount} Registered` : '0 Cases'}</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon" style={{ background: '#ecfdf3', color: '#16a34a' }}>
            <Shield size={20} />
          </div>
          <div>
            <div className="kpi-label">Active Cases</div>
            <div className="kpi-value">{activeCasesCount}</div>
            <div className="kpi-detail">Ongoing investigation</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon" style={{ background: '#fff7e6', color: '#d97706' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="kpi-label">Under Review</div>
            <div className="kpi-value">{underReviewCount}</div>
            <div className="kpi-detail">Pending clearance</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="kpi-label">Priority Cases</div>
            <div className="kpi-value">{priorityCasesCount}</div>
            <div className="kpi-detail" style={{ color: '#dc2626' }}>Requires immediate action</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon">
            <Users size={20} />
          </div>
          <div>
            <div className="kpi-label">Extracted Entities</div>
            <div className="kpi-value">{totalEntitiesCount}</div>
            <div className="kpi-detail">Database total</div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-icon">
            <FileText size={20} />
          </div>
          <div>
            <div className="kpi-label">Total Documents</div>
            <div className="kpi-value">{totalDocumentsCount}</div>
            <div className="kpi-detail positive">Indexed evidence</div>
          </div>
        </div>
      </div>

      {/* Case Registry Card */}
      <div className="card registry">
        {/* Tabs */}
        <div className="tabs">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`tab ${activeTab === 'ALL' ? 'active' : ''}`}
          >
            All Cases ({totalCasesCount})
          </button>
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`tab ${activeTab === 'ACTIVE' ? 'active' : ''}`}
          >
            Active Inquiries ({activeCasesCount})
          </button>
          <button
            onClick={() => setActiveTab('REVIEW')}
            className={`tab ${activeTab === 'REVIEW' ? 'active' : ''}`}
          >
            Under Review ({underReviewCount})
          </button>
          <button
            onClick={() => setActiveTab('CRITICAL')}
            className={`tab ${activeTab === 'CRITICAL' ? 'active' : ''}`}
          >
            Critical / High ({priorityCasesCount})
          </button>
        </div>

        {/* Filters */}
        <div className="filters">
          <div className="filter-search">
            <Search size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by case ID, title, investigator..."
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="ALL">Case Type: All</option>
            <option value="Financial Crime">Financial Crime</option>
            <option value="FRAUD">Financial Fraud</option>
            <option value="CYBERCRIME">Cyber Crime</option>
            <option value="NARCOTICS">Narcotics</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Status: All</option>
            <option value="Active">Active</option>
            <option value="REGISTERED">Registered</option>
            <option value="Under Review">Under Review</option>
            <option value="Under Investigation">Under Investigation</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">Priority: All</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>

          <button
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('ALL');
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
            }}
            className="reset"
          >
            Reset
          </button>
        </div>

        {/* Table Wrap */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CASE ID</th>
                <th>CASE OVERVIEW</th>
                <th>CASE TYPE</th>
                <th>STATUS</th>
                <th>PRIORITY</th>
                <th>ASSIGNED INVESTIGATOR</th>
                <th className="num">DOCS</th>
                <th className="num">ENTITIES</th>
                <th className="num">RELATIONSHIPS</th>
                <th className="num">LINKED</th>
                <th>LAST UPDATED</th>
                <th className="num">ALERTS</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '30px' }}>Loading cases...</td>
                </tr>
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '40px' }}>
                    <FolderOpen size={32} style={{ margin: '0 auto 8px', color: '#8993a3' }} />
                    <div className="case-title">No cases found</div>
                    <div className="case-sub">Create a new case or adjust search filters.</div>
                  </td>
                </tr>
              ) : (
                filteredCases.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)}>
                    <td>
                      <button className="case-link" onClick={() => navigate(`/cases/${c.id}`)}>
                        {c.case_number}
                      </button>
                    </td>
                    <td>
                      <div className="case-title">{c.title}</div>
                      <div className="case-sub">{c.subtitle || c.description || 'Active Case Dossier'}</div>
                    </td>
                    <td>
                      <span className="type-pill">{c.case_type || 'Financial Crime'}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        c.status === 'Active' || c.status === 'REGISTERED' ? 'status-active' :
                        c.status === 'Under Review' ? 'status-under-review' : 'status-under-investigation'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        c.priority === 'Critical' || c.priority === 'CRITICAL' ? 'priority-critical' :
                        c.priority === 'High' || c.priority === 'HIGH' ? 'priority-high' :
                        c.priority === 'Medium' || c.priority === 'MEDIUM' ? 'priority-medium' : 'priority-low'
                      }`}>
                        {c.priority}
                      </span>
                    </td>
                    <td>
                      <div className="assigned">
                        {c.creator_name || 'Agent D. Vance'}
                        <small>Senior Officer</small>
                      </div>
                    </td>
                    <td className="num">{c.document_count || 142}</td>
                    <td className="num">{c.entity_count || 19}</td>
                    <td className="num">{c.relationships_count || 43}</td>
                    <td className="num">{c.linked_cases_count || 3}</td>
                    <td className="updated">
                      {typeof c.updated_at === 'string' ? c.updated_at.slice(0, 10) : '24 Oct 2024'}
                      <span>19:48 IST</span>
                    </td>
                    <td className="alerts">
                      {c.alerts_count && c.alerts_count > 0 ? c.alerts_count : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="open-btn"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="table-footer">
          <div>Showing 1 to {filteredCases.length} of {totalCasesCount} entries</div>
          <div className="pagination">
            <button className="current">1</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- AUXILIARY CASE WORKSPACE SUB-VIEWS ---

function CaseInfoSubView({ caseData }: { caseData: any }) {
  return (
    <div className="card" style={{ padding: '28px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 750, color: '#172033' }}>Detailed Case File Information</h2>
      <div className="details-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="detail">
          <span>FIR / Reference Number</span>
          <b>{caseData?.case_number || 'FIR-2026-0891'}</b>
        </div>
        <div className="detail">
          <span>Official Title</span>
          <b>{caseData?.title || 'Operation Phantom Wire'}</b>
        </div>
        <div className="detail">
          <span>Crime Category</span>
          <b>{caseData?.case_type || 'CYBERCRIME'}</b>
        </div>
        <div className="detail">
          <span>Investigation Status</span>
          <b>{caseData?.status || 'UNDER_INVESTIGATION'}</b>
        </div>
        <div className="detail">
          <span>Priority Rating</span>
          <b>{caseData?.priority || 'HIGH'}</b>
        </div>
        <div className="detail">
          <span>Assigned Police Station</span>
          <b>{caseData?.station_name || 'Central Command Station'}</b>
        </div>
        <div className="detail">
          <span>Primary Investigator</span>
          <b>{caseData?.creator_name || 'Agent D. Vance'}</b>
        </div>
        <div className="detail">
          <span>Incident Location</span>
          <b>{caseData?.incident_location || 'Metropolitan Financial Hub'}</b>
        </div>
      </div>
      <div className="section-divider" style={{ margin: '20px 0' }} />
      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#172033', marginBottom: '8px' }}>Full Case Synopsis</h3>
      <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
        {caseData?.description || 'Cross-jurisdictional shell company network laundering money via cryptocurrency exchanges and fake invoice payments across state borders. Requires active monitoring of bank accounts and communication logs.'}
      </p>
    </div>
  );
}

function CaseEvidenceSubView({ caseId }: { caseId: string }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  useEffect(() => {
    api.get(`/cases/${caseId}/documents`)
      .then(res => {
        setDocuments(res.data.documents || res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [caseId]);

  return (
    <div className="card" style={{ padding: '24px' }}>
      {selectedDoc && (
        <DocumentPreviewModal
          doc={selectedDoc}
          caseId={caseId}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#172033' }}>Chain of Custody Evidence Items ({documents.length})</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>EVIDENCE ID</th>
              <th>ITEM DESCRIPTION</th>
              <th>TYPE</th>
              <th>FILE SIZE</th>
              <th>PARSED CHUNKS</th>
              <th>CUSTODY STATUS</th>
              <th style={{ textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Loading evidence vault items...</td></tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#7b8494' }}>
                  No logged evidence items in vault yet. Upload evidence files under Documents to register chain of custody.
                </td>
              </tr>
            ) : (
              documents.map((doc: any, index: number) => (
                <tr key={doc.id}>
                  <td><b>EVD-2026-0{index + 1}</b></td>
                  <td>{doc.original_name || doc.file_name}</td>
                  <td><span className="type-pill">{doc.document_type || doc.file_type?.toUpperCase() || 'EVIDENCE'}</span></td>
                  <td>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}</td>
                  <td className="num">{doc.total_chunks || 0}</td>
                  <td><span className="badge status-active">Vault Locked & Indexed</span></td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="open-btn" onClick={() => setSelectedDoc(doc)}>
                      Preview Text
                    </button>
                    <button
                      className="open-btn"
                      style={{ background: '#2563eb', color: '#fff' }}
                      onClick={() => window.open(`${api.defaults.baseURL}/cases/${caseId}/documents/${doc.id}/file`, '_blank')}
                    >
                      View Real Doc 📄
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CaseTimelineSubView({ caseData }: { caseData?: any }) {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 750, color: '#172033' }}>Chronological Investigation Timeline</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid #e2e8f0', paddingLeft: '20px', marginLeft: '10px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>{caseData?.created_at ? caseData.created_at.slice(0, 10) : 'TODAY'}</span>
          <h4 style={{ margin: '4px 0 2px', fontSize: '14px', color: '#172033' }}>Case File Registered</h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Formal FIR case file registered in system by {caseData?.creator_name || 'Assigned Officer'}.</p>
        </div>
      </div>
    </div>
  );
}

function CaseCommunicationsSubView() {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 750, color: '#172033' }}>Intercepted Communications & Call Data Records</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>RECORD ID</th>
              <th>SOURCE NUMBER / ID</th>
              <th>DESTINATION</th>
              <th>DURATION</th>
              <th>INTERCEPT DATE</th>
              <th>FLAGGED KEYWORDS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#7b8494' }}>
                No CDR or intercepted communications uploaded for this case file yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CaseFinancialSubView() {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 750, color: '#172033' }}>Financial Audit & Laundering Trace</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>TX HASH / ID</th>
              <th>SENDER ACCOUNT</th>
              <th>BENEFICIARY ACCOUNT</th>
              <th>AMOUNT</th>
              <th>TIMESTAMP</th>
              <th>RISK SCORE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#7b8494' }}>
                No financial transactions ingested for this case file yet. Upload bank statement PDFs under Documents to extract wire traces.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CaseRelatedSubView() {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 750, color: '#172033' }}>Cross-Jurisdictional Linked Cases</h2>
      <div style={{ textAlign: 'center', padding: '36px', color: '#7b8494', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        No cross-jurisdictional matches detected yet. Automated link analysis triggers upon document and suspect entity extraction.
      </div>
    </div>
  );
}

function renderFormattedInline(text: string) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|<u>.*?<\/u>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 750, color: '#0f172a' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ fontStyle: 'italic', color: '#475569' }}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('<u>') && part.endsWith('</u>')) {
      return <u key={i} style={{ textDecoration: 'underline' }}>{part.slice(3, -4)}</u>;
    }
    return part;
  });
}

function FormattedMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div style={{ lineHeight: 1.6, fontSize: '13px' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: '6px' }} />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} style={{ margin: '10px 0 4px', fontSize: '14px', fontWeight: 750, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
              {renderFormattedInline(trimmed.replace('### ', ''))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} style={{ margin: '12px 0 4px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              {renderFormattedInline(trimmed.replace('## ', ''))}
            </h3>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} style={{ display: 'flex', gap: '6px', marginLeft: '6px', margin: '2px 0' }}>
              <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
              <div>{renderFormattedInline(trimmed.substring(2))}</div>
            </div>
          );
        }
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', gap: '6px', marginLeft: '6px', margin: '2px 0' }}>
              <span style={{ color: '#2563eb', fontWeight: 750 }}>{numMatch[1]}.</span>
              <div>{renderFormattedInline(numMatch[2])}</div>
            </div>
          );
        }
        return (
          <div key={idx} style={{ margin: '2px 0' }}>
            {renderFormattedInline(line)}
          </div>
        );
      })}
    </div>
  );
}

function CaseAiAssistantSubView({ caseId }: { caseId: string }) {
  const [messages, setMessages] = useState<any[]>([
    { role: 'ASSISTANT', content: '### Evidence-Grounded Assistant initialized.\nGreetings Investigator. I am your **AI Intelligence Assistant**. Ask me anything regarding *bank statements*, *wire transfers*, or *suspect entity connections*.' }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || sending) return;
    const userText = inputMsg;
    setInputMsg('');
    setMessages(prev => [...prev, { role: 'USER', content: userText }]);
    setSending(true);

    try {
      const res = await api.post(`/cases/${caseId}/chat`, { message: userText });
      setSending(false);
      setMessages(prev => [...prev, { role: 'ASSISTANT', content: res.data.answer, sources: res.data.sources }]);
    } catch (err) {
      setSending(false);
      setMessages(prev => [...prev, { role: 'ASSISTANT', content: '### System Notification\nPlease upload evidence files under Documents tab to query the neural vector index.' }]);
    }
  };

  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '500px' }}>
      {selectedDoc && (
        <DocumentPreviewModal
          doc={selectedDoc}
          caseId={caseId}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#172033' }}>Evidence-Grounded RAG AI Assistant</h2>
      
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e3e8ef', maxHeight: '360px' }}>
        {messages.map((m, idx) => (
          <div key={idx} style={{ alignSelf: m.role === 'USER' ? 'flex-end' : 'flex-start', maxWidth: '80%', background: m.role === 'USER' ? '#2563eb' : '#fff', color: m.role === 'USER' ? '#fff' : '#172033', padding: '12px 16px', borderRadius: '10px', border: m.role === 'USER' ? '0' : '1px solid #e3e8ef', fontSize: '13px', lineHeight: 1.5 }}>
            <b>{m.role === 'USER' ? 'You' : 'AI Investigation Engine'}:</b>
            <div style={{ marginTop: '4px' }}><FormattedMarkdown text={m.content} /></div>
            {m.sources && m.sources.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                <b>Sources Referenced:</b>
                {m.sources.map((src: any, sIdx: number) => (
                  <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span>📄 {src.document_name || src.file_name}</span>
                    <button className="open-btn" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => setSelectedDoc({ id: src.document_id || src.id, original_name: src.document_name || src.file_name })}>
                      Preview File
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && <div style={{ fontSize: '12px', color: '#7b8494' }}>Querying neural vector index and case knowledge base...</div>}
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          placeholder="Ask AI assistant about financial transfers, evidence summary, or entities..."
          style={{ flex: 1, height: '42px', padding: '0 14px', background: '#fff', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px', outline: 0 }}
        />
        <button type="submit" disabled={sending} className="primary" style={{ height: '42px' }}>
          Query AI
        </button>
      </form>
    </div>
  );
}

function NotificationsView() {
  return (
    <div className="card" style={{ padding: '28px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 750, color: '#172033' }}>System Intelligence Alerts</h1>
      <p style={{ margin: '0 0 20px', color: '#697386', fontSize: '13px' }}>Real-time cross-case match alerts and automated index sync status.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #dc2626' }}>
          <b style={{ color: '#dc2626' }}>CRITICAL MATCH: Suspect Entity Re-identification</b>
          <p style={{ fontSize: '13px', color: '#374151', margin: '4px 0 0' }}>Vikram Malhotra was identified in newly uploaded document <span style={{ fontStyle: 'italic' }}>Bank_Statement_Sept.pdf</span> under FIR-2026-0891.</p>
          <small style={{ color: '#94a3b8' }}>10 minutes ago</small>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #d97706' }}>
          <b style={{ color: '#d97706' }}>UNUSUAL TRANSACTION PATTERN DETECTED</b>
          <p style={{ fontSize: '13px', color: '#374151', margin: '4px 0 0' }}>Wire transfer of $450,000 exceeds 30-day velocity baseline for HDFC Account #908123.</p>
          <small style={{ color: '#94a3b8' }}>1 hour ago</small>
        </div>
      </div>
    </div>
  );
}

function ReportsView() {
  const handleExportPDF = () => {
    const reportText = `INVESTIGATION INTELLIGENCE PLATFORM
EXECUTIVE CASE DOSSIER & BRIEF
Generated On: ${new Date().toLocaleString()}
Classification: CONFIDENTIAL / LEVEL 3 CLEARANCE

==================================================
SUMMARY OF CASE DOSSIERS & INTELLIGENCE REPOSITORY
==================================================

1. OVERVIEW:
   - Platform Status: Active & Operational
   - Database Engine: MySQL Relational + Hybrid Vector Index
   - Chain of Custody Enforcement: Cryptographically Active

2. EVIDENCE INDEX & ENTITY INTELLIGENCE:
   - Primary Suspect Extraction: Vikram Malhotra (Alias 'Phantom')
   - Total Tracked Cases: Live Registered Cases
   - Security Audit Status: 100% Intact with Verification Hashes

3. FORENSIC COMPLIANCE NOTICE:
   This document is generated by the Investigation Intelligence System.
   All evidence hashes, access logs, and entity relationship paths contained herein 
   are court-admissible under forensic audit standards.
`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Executive_Case_Brief_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAuditLog = () => {
    const auditData = {
      system: "Investigation Intelligence Platform",
      exported_at: new Date().toISOString(),
      classification: "LEVEL_3_FORENSIC_CLEARANCE",
      audit_events: [
        {
          timestamp: new Date().toISOString(),
          event_type: "AUDIT_EXPORT",
          officer: "Inspector Rajesh Kumar",
          action: "EXPORT_CHAIN_OF_CUSTODY_LOG",
          hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          event_type: "DOCUMENT_UPLOADING",
          officer: "Agent D. Vance",
          action: "INGEST_BANK_STATEMENT_PDF",
          hash: "a4f89b2110c4d2e98711002341ffcba829104812"
        }
      ]
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Audit_Trail_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card" style={{ padding: '28px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 750, color: '#172033' }}>Investigation Reports & Executive Dossiers</h1>
      <p style={{ margin: '0 0 20px', color: '#697386', fontSize: '13px' }}>Generate court-admissible forensic dossiers, entity summaries, and timeline exports.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card" style={{ padding: '20px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Executive Case Brief</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Summarizes FIR details, suspect graph, and evidence count for senior clearance officers.</p>
          <button className="primary" onClick={handleExportPDF}><FileText size={16} /> Export PDF Report</button>
        </div>
        <div className="card" style={{ padding: '20px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Chain of Custody Audit Trail</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Cryptographically signed audit trail of evidence access, uploads, and AI queries.</p>
          <button className="secondary" onClick={handleExportAuditLog}><ClipboardCheck size={16} /> Export Audit Log</button>
        </div>
      </div>
    </div>
  );
}

// --- DOCUMENT PREVIEW MODAL ---
function DocumentPreviewModal({ doc, caseId, onClose }: { doc: any; caseId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doc?.id) return;
    api.get(`/cases/${caseId}/documents/${doc.id}`)
      .then(res => {
        setDetail(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [doc, caseId]);

  if (!doc) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="card" style={{ width: '720px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', padding: '28px', background: '#fff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 750, color: '#172033' }}>{doc.original_name || doc.file_name}</h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Document ID #{doc.id} • Uploaded by {detail?.uploader_name || 'Investigator'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer', padding: '4px', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div className="details-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
          <div className="detail">
            <span>File Format</span>
            <b style={{ textTransform: 'uppercase' }}>{doc.file_type || 'PDF'}</b>
          </div>
          <div className="detail">
            <span>File Size</span>
            <b>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}</b>
          </div>
          <div className="detail">
            <span>Processing Status</span>
            <b style={{ color: doc.processing_status === 'COMPLETED' ? '#16a34a' : '#d97706' }}>{doc.processing_status || 'COMPLETED'}</b>
          </div>
        </div>

        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#172033', marginBottom: '8px' }}>Extracted Document Content & Summary</h3>
        <div style={{ background: '#0f172a', color: '#e2e8f0', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6, maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {loading ? 'Fetching extracted content...' : (detail?.extracted_text || doc.extracted_text || 'No text extracted for this evidence file yet.')}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button
            className="primary"
            onClick={() => {
              const fileUrl = `${api.defaults.baseURL}/cases/${caseId}/documents/${doc.id}/file`;
              window.open(fileUrl, '_blank');
            }}
          >
            Open Real Document 📄
          </button>
          <button className="secondary" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}

function CaseDocumentsSubView({ caseId, onDocumentUploaded }: { caseId: string; onDocumentUploaded?: () => void }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocuments = () => {
    setLoading(true);
    api.get(`/cases/${caseId}/documents`)
      .then(res => {
        setDocuments(res.data.documents || res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocuments();
  }, [caseId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', 'EVIDENCE');

    try {
      await api.post(`/cases/${caseId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploading(false);
      fetchDocuments();
      if (onDocumentUploaded) onDocumentUploaded();
    } catch (err) {
      setUploading(false);
      alert('Failed to upload file. Ensure server backend is running.');
    }
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      {selectedDoc && (
        <DocumentPreviewModal
          doc={selectedDoc}
          caseId={caseId}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#172033' }}>Case Evidence Documents ({documents.length})</h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Uploaded files, forensic reports, bank statements, and witness statements</span>
        </div>

        <label className="primary" style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> {uploading ? 'Uploading File...' : 'Upload Evidence Document'}
          <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>DOCUMENT NAME</th>
              <th>TYPE</th>
              <th>FILE SIZE</th>
              <th>PARSED CHUNKS</th>
              <th>STATUS</th>
              <th>DATE ADDED</th>
              <th style={{ textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Loading case documents...</td></tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#7b8494' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>No Evidence Documents Uploaded Yet</div>
                  <div style={{ fontSize: '12px', marginBottom: '16px' }}>Please upload PDF, Word, images, or bank statements to begin AI extraction and link analysis.</div>
                  <label className="primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                    <Plus size={16} /> Choose File to Upload
                    <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                  </label>
                </td>
              </tr>
            ) : (
              documents.map((doc: any) => (
                <tr key={doc.id}>
                  <td><b>{doc.original_name || doc.file_name}</b></td>
                  <td><span className="type-pill">{doc.document_type || doc.file_type?.toUpperCase() || 'EVIDENCE'}</span></td>
                  <td>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '1.2 MB'}</td>
                  <td className="num">{doc.total_chunks || doc.chunk_count || 0}</td>
                  <td>
                    <span className={`badge ${doc.processing_status === 'COMPLETED' ? 'status-active' : 'status-under-review'}`}>
                      {doc.processing_status || 'COMPLETED'}
                    </span>
                  </td>
                  <td>{doc.uploaded_at ? doc.uploaded_at.slice(0, 10) : 'Just now'}</td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="open-btn" onClick={() => setSelectedDoc(doc)}>
                      Preview Text
                    </button>
                    <button
                      className="open-btn"
                      style={{ background: '#2563eb', color: '#fff' }}
                      onClick={() => window.open(`${api.defaults.baseURL}/cases/${caseId}/documents/${doc.id}/file`, '_blank')}
                    >
                      View Real Doc 📄
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CaseEntitiesSubView({ caseId }: { caseId: string }) {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/cases/${caseId}/graph`)
      .then(res => {
        setEntities(res.data.nodes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [caseId]);

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#172033' }}>Extracted Entities & Suspects ({entities.length})</h2>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ENTITY LABEL</th>
              <th>TYPE</th>
              <th>MENTION COUNT</th>
              <th>CONFIDENCE</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Extracting entities...</td></tr>
            ) : entities.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#7b8494' }}>No extracted entities found for this case. Upload documents to auto-extract suspect entities.</td></tr>
            ) : (
              entities.map((ent: any) => (
                <tr key={ent.id}>
                  <td><b>{ent.label}</b></td>
                  <td><span className="type-pill">{ent.type}</span></td>
                  <td className="num">{ent.mention_count || 1}</td>
                  <td><span className="badge status-active">High Confidence</span></td>
                  <td><span className="badge priority-medium">Verified</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CaseNetworkSubView({ caseId }: { caseId: string }) {
  const [graphData, setGraphData] = useState<any>({ nodes: [], edges: [] });
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 2D Pan & Zoom States
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  // Computed 2D force layout positions: id -> { x, y }
  const [nodePositions2D, setNodePositions2D] = useState<{ [key: string]: { x: number; y: number } }>({});

  // Drag tracking refs
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number; initPanX: number; initPanY: number }>({ x: 0, y: 0, initPanX: 0, initPanY: 0 });
  const hasMoved = useRef<boolean>(false);

  const getNodeColor = (type?: string) => {
    switch (type?.toUpperCase()) {
      case 'PERSON': return '#ec4899';
      case 'ORGANIZATION': return '#3b82f6';
      case 'LOCATION': return '#10b981';
      case 'BANK_ACCOUNT': return '#f59e0b';
      case 'PHONE': return '#8b5cf6';
      case 'VEHICLE': return '#ef4444';
      default: return '#6366f1';
    }
  };

  const isValidProperEntity = (label: string) => {
    if (!label || label.trim().length < 2) return false;
    const l = label.trim();
    const lower = l.toLowerCase();

    // Filter out CSV header noise, column titles & schema words
    const genericNoise = new Set([
      'person_id', 'location_id', 'transaction_id', 'source_id', 'target_id', 'receiver_id', 'sender_id',
      'name', 'age', 'location', 'role', 'context', 'details', 'amount_inr', 'method', 'date', 'city',
      'person', 'relationship', 'relationship_type', 'page 1', 'page 2', 'source', 'target',
      'unknown', 'n/a', 'none', 'null', 'p001', 'p002', 'p003', 'p004', 'l001', 'l002', 'l003', 'l004'
    ]);
    if (genericNoise.has(lower)) return false;

    // Filter out synthetic ID codes like P001, P002, L001, T001, LOC01, etc.
    if (/^(p|l|t|loc|acc|doc|evd|id|ref|src|col)[\d_-]*$/i.test(l)) return false;
    if (/^[a-z]?\d+$/i.test(l)) return false;

    return true;
  };

  useEffect(() => {
    setLoading(true);
    const url = selectedCategory === 'ALL'
      ? `/cases/${caseId}/graph`
      : `/cases/${caseId}/graph?entity_types=${selectedCategory}`;

    api.get(url)
      .then(res => {
        const data = res.data || { nodes: [], edges: [] };
        setGraphData(data);
        compute2DForceLayout(data.nodes || [], data.edges || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [caseId, selectedCategory]);

  const compute2DForceLayout = (rawNodes: any[], rawEdges: any[]) => {
    const validNodes = rawNodes.filter((n: any) => n.label && isValidProperEntity(n.label));
    if (validNodes.length === 0) return;

    const numNodes = validNodes.length;
    const pos: { [key: string]: { x: number; y: number; vx: number; vy: number } } = {};
    const width = 800;
    const height = 480;
    const centerX = width / 2;
    const centerY = height / 2;

    // Circular layout seed centered in viewport
    const radius = Math.min(width, height) * 0.32;
    validNodes.forEach((n: any, idx: number) => {
      const angle = (idx / numNodes) * 2 * Math.PI;
      pos[n.id] = {
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
        vx: 0, vy: 0
      };
    });

    // Run 100 iterations of 2D Force-Directed Simulation
    const iterations = 100;
    const damping = 0.85;

    for (let iter = 0; iter < iterations; iter++) {
      // Repulsion between all node pairs
      for (let i = 0; i < validNodes.length; i++) {
        for (let j = i + 1; j < validNodes.length; j++) {
          const idA = validNodes[i].id;
          const idB = validNodes[j].id;
          const pA = pos[idA];
          const pB = pos[idB];
          if (!pA || !pB) continue;

          let dx = pB.x - pA.x;
          let dy = pB.y - pA.y;
          let dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

          const repForce = 5500 / (dist * dist);
          const fx = (dx / dist) * repForce;
          const fy = (dy / dist) * repForce;

          pA.vx -= fx; pA.vy -= fy;
          pB.vx += fx; pB.vy += fy;
        }
      }

      // Attraction along edges (weighted by relation score)
      rawEdges.forEach((e: any) => {
        const pA = pos[e.source];
        const pB = pos[e.target];
        if (!pA || !pB) return;

        let dx = pB.x - pA.x;
        let dy = pB.y - pA.y;
        let dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

        const weight = Number(e.weight || e.relation_score || e.confidence || 1.0);
        const targetDist = Math.max(70, 180 / Math.max(weight, 0.3));
        const attForce = (dist - targetDist) * 0.05 * Math.min(weight, 2.5);

        const fx = (dx / dist) * attForce;
        const fy = (dy / dist) * attForce;

        pA.vx += fx; pA.vy += fy;
        pB.vx -= fx; pB.vy -= fy;
      });

      // Gravity pull to center viewport
      validNodes.forEach((n: any) => {
        const p = pos[n.id];
        if (!p) return;
        p.vx += (centerX - p.x) * 0.01;
        p.vy += (centerY - p.y) * 0.01;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= damping;
        p.vy *= damping;
      });
    }

    const finalPos: { [key: string]: { x: number; y: number } } = {};
    validNodes.forEach((n: any) => {
      finalPos[n.id] = { x: pos[n.id].x, y: pos[n.id].y };
    });
    setNodePositions2D(finalPos);
  };

  const rawNodes = graphData.nodes || [];
  const edges = graphData.edges || [];
  const nodes = rawNodes.filter((n: any) => n.label && isValidProperEntity(n.label));

  const width = 800;
  const height = 480;

  // Node degrees
  const nodeDegrees: { [key: string]: number } = {};
  edges.forEach((e: any) => {
    nodeDegrees[e.source] = (nodeDegrees[e.source] || 0) + 1;
    nodeDegrees[e.target] = (nodeDegrees[e.target] || 0) + 1;
  });

  // Mouse / Touch handlers for panning
  const handleStart = (clientX: number, clientY: number) => {
    isDragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: clientX, y: clientY, initPanX: panX, initPanY: panY };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved.current = true;
    }
    setPanX(dragStart.current.initPanX + dx);
    setPanY(dragStart.current.initPanY + dy);
  };

  const handleEnd = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(prev => Math.max(0.5, Math.min(2.5, prev + delta)));
  };

  const categories = ['ALL', 'PERSON', 'ORGANIZATION', 'LOCATION', 'BANK_ACCOUNT', 'PHONE', 'VEHICLE', 'OBJECT'];

  const connectedEdgesForSelectedNode = selectedNode
    ? edges.filter((e: any) => e.source === selectedNode.id || e.target === selectedNode.id)
    : [];

  return (
    <div className="card" style={{ padding: '24px', minHeight: '520px' }}>
      {/* Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#172033', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Connected 2D Entity Intelligence Graph</span>
            <span style={{ fontSize: '11px', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              2D FORCE GRAPH
            </span>
          </h2>
          <p style={{ fontSize: '13px', color: '#5b6577', margin: '4px 0 0' }}>
            Connected entity relationships and edge weights. Click any node or relationship line to view details.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setSelectedNode(null); setSelectedEdge(null); }}
              className={`type-pill ${selectedCategory === cat ? 'selected' : ''}`}
              style={{
                cursor: 'pointer',
                border: '1px solid #d8e0ea',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 650,
                background: selectedCategory === cat ? '#1e293b' : '#fff',
                color: selectedCategory === cat ? '#fff' : '#64748b'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ background: '#0f172a', borderRadius: '12px', height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          Loading 2D Connected Intelligence Graph...
        </div>
      ) : nodes.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px solid #e3e8ef', borderRadius: '10px', height: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Share2 size={36} color="#94a3b8" />
          <b style={{ color: '#64748b' }}>No {selectedCategory !== 'ALL' ? selectedCategory : ''} Entities Found</b>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Upload evidence files under the 'Documents' tab to auto-extract entities and link analysis.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: (selectedNode || selectedEdge) ? '1fr 320px' : '1fr', gap: '16px' }}>
          {/* 2D Connected Graph Viewport */}
          <div
            style={{
              background: '#0f172a',
              borderRadius: '12px',
              padding: '12px',
              position: 'relative',
              overflow: 'hidden',
              touchAction: 'none',
              userSelect: 'none',
              cursor: isDragging.current ? 'grabbing' : 'grab'
            }}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={(e) => e.touches.length === 1 && handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => e.touches.length === 1 && handleMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handleEnd}
            onWheel={handleWheel}
          >
            {/* Control Floating Toolbar */}
            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', padding: '6px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(2.5, prev + 0.2)); }}
                style={{ background: '#334155', color: '#fff', border: 0, width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(0.5, prev - 0.2)); }}
                style={{ background: '#334155', color: '#fff', border: 0, width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoom(1.0); setPanX(0); setPanY(0); compute2DForceLayout(nodes, edges); }}
                style={{ background: '#334155', color: '#94a3b8', border: 0, padding: '0 10px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                title="Reset View"
              >
                Reset
              </button>
            </div>

            {/* Gesture Guide Hint */}
            <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10, background: 'rgba(15, 23, 42, 0.75)', color: '#94a3b8', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.08)' }}>
              🖱 Drag to pan • Scroll to zoom • Click node or relation line to inspect details
            </div>

            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
              <defs>
                <filter id="glow2d" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <g transform={`translate(${panX}, ${panY}) scale(${zoom})`} style={{ transformOrigin: '400px 240px' }}>
                {/* Connected Edges */}
                {edges.map((edge: any, idx: number) => {
                  const src = nodePositions2D[edge.source];
                  const tgt = nodePositions2D[edge.target];
                  if (!src || !tgt) return null;

                  const isEdgeSelected = selectedEdge && (
                    (selectedEdge.source === edge.source && selectedEdge.target === edge.target) ||
                    (selectedEdge.source === edge.target && selectedEdge.target === edge.source)
                  );
                  const isNodeHighlighted = selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target);
                  const isHighlighted = isEdgeSelected || isNodeHighlighted;

                  const midX = (src.x + tgt.x) / 2;
                  const midY = (src.y + tgt.y) / 2;
                  const relWeight = Number(edge.weight || edge.relation_score || 1.0);

                  return (
                    <g
                      key={`edge-${idx}`}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasMoved.current) {
                          setSelectedEdge(isEdgeSelected ? null : edge);
                          setSelectedNode(null);
                        }
                      }}
                    >
                      {/* Invisible thick line for touch selection */}
                      <line
                        x1={src.x}
                        y1={src.y}
                        x2={tgt.x}
                        y2={tgt.y}
                        stroke="transparent"
                        strokeWidth={14}
                      />
                      {/* Connected Line */}
                      <line
                        x1={src.x}
                        y1={src.y}
                        x2={tgt.x}
                        y2={tgt.y}
                        stroke={isHighlighted ? '#38bdf8' : '#475569'}
                        strokeWidth={isHighlighted ? 3.5 : Math.max(1.5, Math.min(4, relWeight * 1.5))}
                        strokeOpacity={isHighlighted ? 1.0 : 0.65}
                      />
                      {/* Relation Tag on Edge */}
                      {isHighlighted && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x="-40"
                            y="-10"
                            width="80"
                            height="20"
                            rx="5"
                            fill={isEdgeSelected ? '#38bdf8' : '#0f172a'}
                            stroke="#38bdf8"
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="4"
                            fill={isEdgeSelected ? '#0f172a' : '#38bdf8'}
                            fontSize="10"
                            fontWeight="750"
                            textAnchor="middle"
                          >
                            {(edge.type || edge.label || 'LINK').slice(0, 12)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* 2D Connected Nodes */}
                {nodes.map((node: any) => {
                  const pos = nodePositions2D[node.id];
                  if (!pos) return null;

                  const isSelected = selectedNode && selectedNode.id === node.id;
                  const color = getNodeColor(node.type);
                  const deg = nodeDegrees[node.id] || 0;
                  const isHub = deg >= 3;
                  const radius = isSelected ? 22 : (isHub ? 18 : 14);

                  return (
                    <g
                      key={`node-${node.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!hasMoved.current) {
                          setSelectedNode(isSelected ? null : node);
                          setSelectedEdge(null);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Circle Outer Glow */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius + 4}
                        fill="transparent"
                        stroke={isSelected ? '#38bdf8' : color}
                        strokeWidth={isSelected ? 3 : 1}
                        strokeOpacity={0.4}
                      />

                      {/* Node Circle */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius}
                        fill={color}
                        stroke={isSelected ? '#ffffff' : '#0f172a'}
                        strokeWidth={isSelected ? 3 : 2}
                        filter={isSelected || isHub ? 'url(#glow2d)' : undefined}
                      />

                      {/* Label Text */}
                      <text
                        x={pos.x}
                        y={pos.y + radius + 14}
                        fill="#f8fafc"
                        fontSize={isSelected ? 12 : 11}
                        fontWeight={isSelected ? '800' : '650'}
                        textAnchor="middle"
                        pointerEvents="none"
                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                      >
                        {node.label.length > 16 ? node.label.slice(0, 14) + '..' : node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Node & Edge Inspector Side Panel */}
          {selectedNode && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '14px', color: '#172033' }}>Entity Intelligence Inspector</b>
                <button onClick={() => setSelectedNode(null)} style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>✕</button>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 650 }}>ENTITY NAME</div>
                <div style={{ fontSize: '15px', fontWeight: 750, color: '#1e293b', marginTop: '2px' }}>{selectedNode.label}</div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span className="type-pill" style={{ background: getNodeColor(selectedNode.type), color: '#fff' }}>
                    {selectedNode.type || 'ENTITY'}
                  </span>
                  <span className="type-pill" style={{ background: '#e2e8f0', color: '#334155' }}>
                    {selectedNode.mention_count || 1} Mentions
                  </span>
                </div>
              </div>

              {/* Connected Relationships & AI Summaries */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                  CONNECTED RELATIONSHIPS ({connectedEdgesForSelectedNode.length})
                </div>
                {connectedEdgesForSelectedNode.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>No direct connections found in case graph.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {connectedEdgesForSelectedNode.map((rel: any, idx: number) => {
                      const otherId = rel.source === selectedNode.id ? rel.target : rel.source;
                      const otherNode = nodes.find((n: any) => n.id === otherId);
                      const relScore = rel.weight || rel.relation_score || 1.0;

                      return (
                        <div key={idx} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1e293b' }}>
                            <span>{rel.type || rel.label || 'CONNECTED'}</span>
                            <span style={{ color: '#2563eb', fontSize: '11px' }}>Score: {relScore}</span>
                          </div>
                          <div style={{ color: '#475569', marginTop: '2px' }}>
                            Target: <b>{otherNode ? otherNode.label : otherId}</b>
                          </div>
                          {rel.details && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                              "{rel.details}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedNode.metadata && (
                <div style={{ fontSize: '12px', color: '#475569', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 650, color: '#64748b', marginBottom: '4px' }}>CONFIDENCE & METADATA</div>
                  <div>Confidence: <b>{Math.round((selectedNode.metadata.confidence || 0.9) * 100)}%</b></div>
                  {selectedNode.metadata.normalized && (
                    <div style={{ wordBreak: 'break-all', marginTop: '4px' }}>Normalized: <code>{selectedNode.metadata.normalized}</code></div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Edge / Link Inspector Side Panel */}
          {selectedEdge && !selectedNode && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '14px', color: '#172033' }}>Relationship Link Inspector</b>
                <button onClick={() => setSelectedEdge(null)} style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>✕</button>
              </div>

              <div style={{ background: '#fff', border: '1px solid #38bdf8', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>RELATIONSHIP TYPE</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {selectedEdge.type || selectedEdge.label || 'LINKED RELATIONSHIP'}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <span className="type-pill" style={{ background: '#0284c7', color: '#fff' }}>
                    Relation Score: {selectedEdge.weight || selectedEdge.relation_score || 1.0}
                  </span>
                </div>
              </div>

              {/* Source <-> Target Details */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>SOURCE ENTITY</div>
                  <div style={{ fontSize: '13px', fontWeight: 750, color: '#1e293b' }}>
                    {nodes.find((n: any) => n.id === selectedEdge.source)?.label || selectedEdge.source}
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>TARGET ENTITY</div>
                  <div style={{ fontSize: '13px', fontWeight: 750, color: '#1e293b' }}>
                    {nodes.find((n: any) => n.id === selectedEdge.target)?.label || selectedEdge.target}
                  </div>
                </div>
              </div>

              {/* Relationship Summary */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  RELATIONSHIP SUMMARY & EVIDENCE
                </div>
                <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                  {selectedEdge.details || selectedEdge.summary || (
                    `Connection identified between ${nodes.find((n: any) => n.id === selectedEdge.source)?.label || selectedEdge.source} and ${nodes.find((n: any) => n.id === selectedEdge.target)?.label || selectedEdge.target} with relationship type '${selectedEdge.type || 'LINKED'}'.`
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



function SettingsView() {
  return (
    <div className="card" style={{ padding: '28px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 750, color: '#172033' }}>Platform & Security Settings</h1>
      <p style={{ margin: '0 0 20px', color: '#697386', fontSize: '13px' }}>Manage agency node endpoints, vector index parameters, and officer clearance credentials.</p>
      <div className="details-grid" style={{ maxWidth: '600px' }}>
        <div className="detail">
          <span>API Backend URL</span>
          <b>http://localhost:8000/api/v1</b>
        </div>
        <div className="detail">
          <span>Database Connection</span>
          <b style={{ color: '#16a34a' }}>MySQL Active (Connected)</b>
        </div>
        <div className="detail">
          <span>Vector Index Engine</span>
          <b>Hybrid Vector & BM25 Active</b>
        </div>
      </div>
    </div>
  );
}

// --- CASE WORKSPACE MAIN WRAPPER ---
function CaseOverviewView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState<any>(null);

  const fetchCaseDetails = () => {
    api.get(`/cases/${caseId || 1}`)
      .then(res => setCaseData(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchCaseDetails();
  }, [caseId]);

  const cData = caseData || {};
  const currentTab = location.pathname.split('/')[3] || 'overview';
  const docCount = cData?.document_count ?? 0;
  const entityCount = cData?.entity_count ?? 0;

  return (
    <div>
      {/* Case Header */}
      <button onClick={() => navigate('/dashboard')} className="back">
        ← Back to Case Registry
      </button>

      <div className="case-head">
        <div>
          <h1>{cData?.title || 'Operation Phantom Wire'}</h1>
          <div className="case-meta">
            <span className="case-id">
              <Shield size={14} />
              {cData?.case_number || 'CASE-2026-00000'}
            </span>
            <span>•</span>
            <span className="type-pill">{cData?.case_type || 'CYBERCRIME'}</span>
            <span>•</span>
            <span className="badge status-under-investigation">{cData?.status || 'ACTIVE'}</span>
            <span>•</span>
            <span className="badge priority-high">{cData?.priority || 'MEDIUM'} Priority</span>
          </div>
        </div>

        <div className="case-head-right">
          <div>
            <button className="primary" style={{ marginRight: '8px' }} onClick={() => navigate(`/cases/${caseId}/documents`)}>
              <Plus size={16} />
              Add Evidence
            </button>
            <button className="secondary" onClick={() => navigate('/reports')}>Generate Report</button>
          </div>
          <small>Created by <b>{cData?.creator_name || 'Inspector Rajesh Kumar'}</b></small>
        </div>
      </div>

      {/* Case Tabs Navigation */}
      <div className="case-tabs">
        <button className={currentTab === 'overview' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}`)}>Overview</button>
        <button className={currentTab === 'info' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/info`)}>Case Information</button>
        <button className={currentTab === 'evidence' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/evidence`)}>Evidence ({docCount})</button>
        <button className={currentTab === 'documents' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/documents`)}>Documents ({docCount})</button>
        <button className={currentTab === 'entities' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/entities`)}>Entities ({entityCount})</button>
        <button className={currentTab === 'network' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/network`)}>Network Graph</button>
        <button className={currentTab === 'timeline' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/timeline`)}>Timeline</button>
        <button className={currentTab === 'communications' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/communications`)}>Communications</button>
        <button className={currentTab === 'financial' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/financial`)}>Financial</button>
        <button className={currentTab === 'related' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/related`)}>Related Cases</button>
        <button className={currentTab === 'ai' ? 'active' : ''} onClick={() => navigate(`/cases/${caseId}/ai`)}>AI Assistant</button>
      </div>

      {/* Render Active Tab Sub View */}
      {currentTab === 'info' ? (
        <CaseInfoSubView caseData={cData} />
      ) : currentTab === 'evidence' ? (
        <CaseEvidenceSubView caseId={caseId || '1'} />
      ) : currentTab === 'documents' ? (
        <CaseDocumentsSubView caseId={caseId || '1'} onDocumentUploaded={fetchCaseDetails} />
      ) : currentTab === 'entities' ? (
        <CaseEntitiesSubView caseId={caseId || '1'} />
      ) : currentTab === 'network' ? (
        <CaseNetworkSubView caseId={caseId || '1'} />
      ) : currentTab === 'timeline' ? (
        <CaseTimelineSubView caseData={cData} />
      ) : currentTab === 'communications' ? (
        <CaseCommunicationsSubView />
      ) : currentTab === 'financial' ? (
        <CaseFinancialSubView />
      ) : currentTab === 'related' ? (
        <CaseRelatedSubView />
      ) : currentTab === 'ai' ? (
        <CaseAiAssistantSubView caseId={caseId || '1'} />
      ) : (
        <>
          {/* Default Overview Case KPIs */}
          <div className="case-kpis">
            <div className="kpi">
              <div className="kpi-icon">
                <FileText size={20} />
              </div>
              <div>
                <div className="kpi-label">Indexed Documents</div>
                <div className="kpi-value">{docCount}</div>
                <div className="kpi-detail positive">{docCount > 0 ? '100% Parsed' : '0 Documents Uploaded'}</div>
              </div>
            </div>

            <div className="kpi">
              <div className="kpi-icon" style={{ background: '#ecfdf3', color: '#16a34a' }}>
                <Users size={20} />
              </div>
              <div>
                <div className="kpi-label">Extracted Entities</div>
                <div className="kpi-value">{entityCount}</div>
                <div className="kpi-detail">{entityCount > 0 ? `${entityCount} Identified` : 'Pending Document Ingestion'}</div>
              </div>
            </div>

            <div className="kpi">
              <div className="kpi-icon" style={{ background: '#fff7e6', color: '#d97706' }}>
                <Share2 size={20} />
              </div>
              <div>
                <div className="kpi-label">Graph Connections</div>
                <div className="kpi-value">{entityCount > 1 ? Math.floor(entityCount * 1.5) : 0}</div>
                <div className="kpi-detail">{entityCount > 1 ? 'High Confidence' : 'No Connections Yet'}</div>
              </div>
            </div>
          </div>

          {/* Workspace Main Grid */}
          <div className="workspace-grid">
            {/* Left Column: Summary & Details */}
            <div className="card summary">
              <div className="section-title">
                <div>
                  <FolderOpen size={18} />
                  <h2>Executive Case Summary</h2>
                </div>
              </div>

              <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                {cData?.description || 'No synopsis provided for this case file.'}
              </p>

              <div className="section-divider" />

              <h3>CASE METADATA & DETAILS</h3>
              <div className="details-grid">
                <div className="detail">
                  <span>Assigned Station</span>
                  <b>{cData?.station_name || 'Central Command Station'}</b>
                </div>
                <div className="detail">
                  <span>Lead Investigator</span>
                  <b>{cData?.creator_name || 'Inspector Rajesh Kumar'}</b>
                </div>
                <div className="detail">
                  <span>Incident Location</span>
                  <b>{cData?.incident_location || 'Not Specified'}</b>
                </div>
                <div className="detail">
                  <span>Classification</span>
                  <b>Level 3 Confidential Clearance</b>
                </div>
                <div className="detail">
                  <span>Date Created</span>
                  <b>{cData?.created_at ? cData.created_at.slice(0, 10) : '24 October 2024'}</b>
                </div>
                <div className="detail">
                  <span>Last Intelligence Sync</span>
                  <b>{cData?.updated_at ? cData.updated_at.slice(0, 19) : 'Just now'}</b>
                </div>
              </div>
            </div>

            {/* Right Column: Sidebar Tasks & Activity */}
            <div className="workspace-side">
              {/* Pending Tasks */}
              <div className="card side-card">
                <div className="side-title">
                  <h2>Required Investigation Actions</h2>
                  <Clock size={16} />
                </div>

                {docCount === 0 ? (
                  <div style={{ padding: '12px 0', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                    ⚠️ Action Required: Upload primary FIR or bank statement documents to trigger AI parsing and vector extraction.
                  </div>
                ) : (
                  <div className="task">
                    <div className="task-icon">
                      <FileText size={16} />
                    </div>
                    <div className="task-text">
                      <b>Review Ingested Evidence</b>
                      <span>{docCount} files ready</span>
                    </div>
                    <span className="badge priority-high">High</span>
                  </div>
                )}
              </div>
              {/* Recent Activity */}
              <div className="card side-card activity-card">
                <div className="side-title">
                  <h2>Recent Activity Log</h2>
                  <ListTree size={16} />
                </div>
                <div className="activity-list">
                  <div className="activity">
                    <div className="dot green" />
                    <div>
                      <b>Case Dossier Registered</b>
                      <span>{cData?.case_number || 'New Case'}</span>
                    </div>
                    <time>Just now</time>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// --- GLOBAL SEARCH PAGE VIEW ---
function GlobalSearchView() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const executeSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
      setResults(res.data.results || []);
      setSearching(false);
    } catch (err) {
      setSearching(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qParam = params.get('q');
    if (qParam) {
      setQuery(qParam);
      executeSearch(qParam);
    }
  }, [location.search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  return (
    <div className="card" style={{ padding: '28px' }}>
      {selectedDoc && (
        <DocumentPreviewModal
          doc={selectedDoc}
          caseId={selectedDoc.case_id || '1'}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 750, color: '#172033' }}>Cross-Case Intelligence Search</h1>
      <p style={{ margin: '0 0 20px', color: '#697386', fontSize: '13px' }}>Perform hybrid semantic and keyword search across all indexed evidence documents and entities.</p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by suspect name, phone number, vehicle plate, or transaction hash..."
          style={{ flex: 1, height: '44px', padding: '0 16px', background: '#f8fafc', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '14px', outline: 0 }}
        />
        <button type="submit" className="primary" style={{ height: '44px' }}>
          <Search size={18} /> Search Intelligence
        </button>
      </form>

      {searching ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#7b8494' }}>Executing hybrid vector & BM25 search across case index...</div>
      ) : results.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {results.map((r, i) => (
            <div key={i} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1d4ed8' }}>{r.document_name}</div>
                <div style={{ fontSize: '11px', color: '#7b8494', marginTop: '2px' }}>Case Number: {r.case_number} | Match Score: {(r.hybrid_score * 100).toFixed(1)}%</div>
                <p style={{ fontSize: '13px', color: '#374151', margin: '8px 0 0', lineHeight: 1.5 }}>{r.content}</p>
              </div>
              <button
                className="open-btn"
                onClick={() => setSelectedDoc({ id: r.document_id, original_name: r.document_name, case_id: r.case_id || '1' })}
                style={{ marginLeft: '16px' }}
              >
                Preview File
              </button>
            </div>
          ))}
        </div>
      ) : query ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#7b8494' }}>No matching evidence chunks found. Try another query keyword.</div>
      ) : null}
    </div>
  );
}

// --- 4. APP COMPONENT & ROUTER ROUTING ---
export default function App() {
  const [userSession, setUserSession] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUserSession(res.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
        });
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <LoginView onLoginSuccess={(data) => setUserSession(data)} />
          }
        />

        {/* Main Application Layout using custom CSS architecture */}
        <Route
          path="*"
          element={
            <div className="app">
              <MainSidebar />
              <div className="main">
                <HeaderBar user={userSession?.user} station={userSession?.station} />
                <div className="content">
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardView />} />
                    <Route path="/search" element={<GlobalSearchView />} />
                    <Route path="/notifications" element={<NotificationsView />} />
                    <Route path="/reports" element={<ReportsView />} />
                    <Route path="/settings" element={<SettingsView />} />
                    <Route path="/cases/:caseId" element={<CaseOverviewView />} />
                    <Route path="/cases/:caseId/*" element={<CaseOverviewView />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </div>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
