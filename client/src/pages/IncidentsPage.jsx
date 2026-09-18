import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const SEV_MAP    = { CRITICAL:'badge-critical', HIGH:'badge-high', MEDIUM:'badge-medium', LOW:'badge-low' };
const STATUS_MAP = { New:'status-open', Assigned:'status-in_progress', 'In Progress':'status-in_progress', Resolved:'status-resolved', Closed:'status-closed' };
const SEVERITIES = ['','CRITICAL','HIGH','MEDIUM','LOW'];
const STATUSES   = ['','New','Assigned','In Progress','Resolved','Closed'];
const CATEGORIES = ['','PHISHING','MALWARE','UNAUTHORISED_ACCESS','DOS','OTHER'];
const SLA_TARGETS = { CRITICAL:4, HIGH:8, MEDIUM:24, LOW:72 };

function SlaBadge({ severity, createdAt, status }) {
  if (status === 'Resolved' || status === 'Closed') return null;
  const target  = SLA_TARGETS[severity] || 24;
  const elapsed = (Date.now() - new Date(createdAt)) / 3600000;
  const pct     = Math.min((elapsed / target) * 100, 100);
  if (pct < 75) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
      pct >= 100 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
    }`}>
      {pct >= 100 ? 'SLA BREACHED' : 'SLA AT RISK'}
    </span>
  );
}

export default function IncidentsPage() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [severity,  setSeverity]  = useState('');
  const [status,    setStatus]    = useState('');
  const [category,  setCategory]  = useState('');
  const channelRef = useRef(null);

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*, assigned_to_user:users!incidents_assigned_to_fkey(name), created_by_user:users!incidents_created_by_fkey(name)')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setIncidents(data || []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    })();

    // Realtime: subscribe to INSERT and UPDATE on incidents table
    channelRef.current = supabase
      .channel('incidents-list')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        () => fetchAll()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents(prev =>
            prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelRef.current);
    };
  }, []);

  const fmt = d => d
    ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : 'N/A';

  const filtered = incidents.filter(i => {
    const q = search.toLowerCase();
    return (
      (!q || i.title?.toLowerCase().includes(q) || i.affected_asset?.toLowerCase().includes(q) || i.source_ip?.includes(q))
      && (!severity || i.severity === severity)
      && (!status   || i.status   === status)
      && (!category || i.category === category)
    );
  });

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Incident registry</h1>
            <p className="text-gray-500 text-sm mt-0.5">{filtered.length} of {incidents.length} incidents</p>
          </div>
          <Link to="/incidents/new" className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Incident
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents..." className="input pl-9" />
            </div>
            <select value={severity} onChange={e => setSeverity(e.target.value)} className="select">
              {SEVERITIES.map(s => <option key={s} value={s}>{s || 'All Severities'}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="select">
              {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
            </select>
            <select value={category} onChange={e => setCategory(e.target.value)} className="select">
              {CATEGORIES.map(c => <option key={c} value={c}>{c?.replace(/_/g, ' ') || 'All Categories'}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Assigned To</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    Loading incidents...
                  </span>
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600 text-sm">No incidents match your filters.</td></tr>
              )}
              {!loading && filtered.map((inc, idx) => (
                <tr key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
                  className="hover:bg-gray-800/50 cursor-pointer transition-colors">
                  <td className="px-5 py-4 text-gray-600 font-mono text-xs">{idx + 1}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-100">{inc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-500 font-mono">{inc.source_ip || '\u2014'}</p>
                      <SlaBadge severity={inc.severity} createdAt={inc.created_at} status={inc.status} />
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                      {inc.category?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4"><span className={SEV_MAP[inc.severity]}>{inc.severity}</span></td>
                  <td className="px-5 py-4"><span className={STATUS_MAP[inc.status] || 'status-open'}>{inc.status}</span></td>
                  <td className="px-5 py-4 hidden lg:table-cell text-gray-400 text-xs">
                    {inc.assigned_to_user?.name || <span className="text-gray-600 italic">Unassigned</span>}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-gray-500 text-xs font-mono">{fmt(inc.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
