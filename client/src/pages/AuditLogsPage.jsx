import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const ACTIONS = ['','INCIDENT_CREATED','STATUS_CHANGED','COMMENT_ADDED','ASSIGNED','ESCALATED','RESOLVED','CLOSED','USER_LOGIN','USER_LOGOUT'];

export default function AuditLogsPage() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [action,  setAction]  = useState('');
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
      const { data, error } = await query;
      if (error) setError(error.message);
      else setLogs(data || []);
      setLoading(false);
    })();
  }, [page, action, search]);

  const fmt = d => d ? new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : 'N/A';

  const ACTION_COLORS = {
    INCIDENT_CREATED: 'text-blue-400 bg-blue-500/10',
    STATUS_CHANGED:   'text-yellow-400 bg-yellow-500/10',
    COMMENT_ADDED:    'text-green-400 bg-green-500/10',
    ASSIGNED:         'text-purple-400 bg-purple-500/10',
    ESCALATED:        'text-orange-400 bg-orange-500/10',
    RESOLVED:         'text-green-400 bg-green-500/10',
    CLOSED:           'text-gray-400 bg-gray-500/10',
    USER_LOGIN:       'text-teal-400 bg-teal-500/10',
    USER_LOGOUT:      'text-gray-400 bg-gray-500/10',
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Audit <span className="text-blue-400">Logs</span></h1>
          <p className="text-gray-500 text-sm mt-0.5">Immutable record of all system actions</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search details..." className="input pl-9 w-full" />
            </div>
            <select value={action} onChange={e=>{setAction(e.target.value);setPage(1);}} className="select w-full">
              {ACTIONS.map(a => <option key={a} value={a}>{a ? a.replace(/_/g,' ') : 'All Actions'}</option>)}
            </select>
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
              {loading && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-600 text-sm font-sans"><span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Loading...</span></td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-600 text-sm font-sans">No audit entries found.</td></tr>}
              {!loading && logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(log.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium font-sans ${ACTION_COLORS[log.action]||'text-gray-400 bg-gray-500/10'}`}>
                      {log.action?.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-sans">{log.actor?.name || <span className="italic text-gray-600">System</span>}</td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-sans max-w-xs truncate">{log.details || '\u2014'}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-xs font-sans">
                    {log.incident_id
                      ? <Link to={`/incidents/${log.incident_id}`} className="text-blue-400 hover:text-blue-300 hover:underline truncate block max-w-[180px]">{log.incident?.title || log.incident_id}</Link>
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
