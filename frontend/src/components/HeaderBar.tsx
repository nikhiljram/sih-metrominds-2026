import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function HeaderBar({ user, station }: { user: any; station: any }) {
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
