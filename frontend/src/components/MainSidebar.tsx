import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Settings,
  LogOut,
} from 'lucide-react';
import api from '../api';

export default function MainSidebar() {
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
