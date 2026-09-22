import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { abbreviatedName } from '../lib/formatters.js';

const ACTIONS = [
  '', 'INCIDENT_CREATED', 'STATUS_CHANGED', 'SEVERITY_CHANGED', 'INCIDENT_UPDATED', 'COMMENT_ADDED', 'ASSIGNED', 'RESOLVED', 'CLOSED',
  'USER_PROVISIONED', 'USER_ROLE_CHANGED', 'USER_ROLE_REMOVED', 'ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_DELETED',
  'KB_ARTICLE_CREATED', 'KB_ARTICLE_UPDATED', 'KB_ARTICLE_DELETED', 'INCIDENT_ASSET_LINKED', 'INCIDENT_ASSET_UNLINKED',
  'NOTIFICATION_STATE_CHANGED', 'INCIDENT_DELETED',
];

const readableDetails = details => {
  if (!details) return '—';
  try {
    const data = JSON.parse(details);
    const entries = Object.entries(data).filter(([key, value]) => !['before', 'after', 'actor_id'].includes(key) && value != null);
    return entries.map(([key, value]) => `${key.replace(/_/g, ' ')}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' · ') || 'Recorded system action';
  } catch { return details; }
};

export default function AuditLogsPage() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [action,  setAction]  = useState('');
  const [users,   setUsers]   = useState([]);
  const [actor,   setActor]   = useState('');
  const [dateFrom,setDateFrom]= useState('');
  const [dateTo,  setDateTo]  = useState('');
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from('audit_log')
        .select('*, actor:users(name), incident:incidents(title)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page-1)*PAGE_SIZE, page*PAGE_SIZE - 1);
      if (action) query = query.eq('action', action);
      if (search) query = query.ilike('details', `%${search}%`);
      if (actor) query = query.eq('user_id', actor);
      if (dateFrom) query = query.gte('created_at', new Date(`${dateFrom}T00:00:00`).toISOString());
      if (dateTo) {
        const end = new Date(`${dateTo}T00:00:00`);
        end.setDate(end.getDate() + 1);
        query = query.lt('created_at', end.toISOString());
      }
      const { data, error } = await query;
      if (error) setError(error.message);
      else setLogs(data || []);
      setLoading(false);
    })();
  }, [page, action, search, actor, dateFrom, dateTo]);

  useEffect(() => {
    supabase.from('users').select('id, name').order('name').then(({ data, error }) => {
      if (error) setError(error.message);
      else setUsers(data || []);
    });
  }, []);

  const fmt = d => d ? new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : 'N/A';

  const ACTION_COLORS = {
    INCIDENT_CREATED: 'text-red-300 bg-red-500/10',
    STATUS_CHANGED:   'text-red-300 bg-red-500/10',
    SEVERITY_CHANGED: 'text-red-400 bg-red-500/10',
    INCIDENT_UPDATED: 'text-gray-300 bg-gray-500/10',
    COMMENT_ADDED:    'text-gray-300 bg-gray-500/10',
    ASSIGNED:         'text-red-300 bg-red-500/10',
    RESOLVED:         'text-gray-300 bg-gray-500/10',
    CLOSED:           'text-gray-400 bg-gray-500/10',
    USER_ROLE_CHANGED: 'text-red-300 bg-red-500/10',
    USER_ROLE_REMOVED: 'text-red-300 bg-red-500/10',
    USER_PROVISIONED:  'text-red-300 bg-red-500/10',
    ASSET_CREATED:     'text-gray-300 bg-gray-500/10',
    ASSET_UPDATED:     'text-gray-300 bg-gray-500/10',
    ASSET_DELETED:     'text-red-300 bg-red-500/10',
    KB_ARTICLE_CREATED:'text-gray-300 bg-gray-500/10',
    KB_ARTICLE_UPDATED:'text-gray-300 bg-gray-500/10',
    KB_ARTICLE_DELETED:'text-red-300 bg-red-500/10',
    INCIDENT_ASSET_LINKED: 'text-gray-300 bg-gray-500/10',
    INCIDENT_ASSET_UNLINKED: 'text-gray-300 bg-gray-500/10',
    NOTIFICATION_STATE_CHANGED: 'text-red-300 bg-red-500/10',
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Audit <span className="text-red-400">Logs</span></h1>
          <p className="text-gray-500 text-sm mt-0.5">Recorded incident, account, asset, knowledge-base and tracker actions</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search details..." className="input pl-9 w-full" />
            </div>
            <select value={action} onChange={e=>{setAction(e.target.value);setPage(1);}} className="select w-full">
              {ACTIONS.map(a => <option key={a} value={a}>{a ? a.replace(/_/g,' ') : 'All Actions'}</option>)}
            </select>
            <select value={actor} onChange={event => { setActor(event.target.value); setPage(1); }} className="select w-full">
              <option value="">All actors</option>
              {users.map(user => <option key={user.id} value={user.id}>{abbreviatedName(user.name)}</option>)}
            </select>
            <input type="date" aria-label="From date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setPage(1); }} className="input w-full" />
            <input type="date" aria-label="To date" value={dateTo} onChange={event => { setDateTo(event.target.value); setPage(1); }} className="input w-full" />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Incident</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 font-mono">
              {loading && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-600 text-sm font-sans"><span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />Loading...</span></td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-600 text-sm font-sans">No audit entries found.</td></tr>}
              {!loading && logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(log.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium font-sans ${ACTION_COLORS[log.action]||'text-gray-400 bg-gray-500/10'}`}>
                      {log.action?.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-sans">{log.actor?.name ? abbreviatedName(log.actor.name) : <span className="italic text-gray-600">System</span>}</td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-sans max-w-xs truncate" title={readableDetails(log.details)}>{readableDetails(log.details)}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-xs font-sans">
                    {log.incident_id
                      ? <Link to={`/incidents/${log.incident_id}`} className="text-red-400 hover:text-red-300 hover:underline truncate block max-w-[180px]">{log.incident?.title || log.incident_id}</Link>
                      : <span className="text-gray-600">\u2014</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-600">Page {page}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 rounded text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">&larr; Prev</button>
              <button disabled={logs.length < PAGE_SIZE} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 rounded text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next &rarr;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
