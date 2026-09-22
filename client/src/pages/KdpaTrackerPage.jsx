import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const STATE_CLASS = { PENDING: 'badge-high', SENT: 'badge-low', CANCELLED: 'badge-medium' };

const formatDate = value => value ? new Date(value).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Not recorded';

function timeRemaining(deadline, state) {
  if (state === 'CANCELLED') return 'Cancelled';
  const difference = new Date(deadline).getTime() - Date.now();
  const hours = Math.ceil(Math.abs(difference) / 3600000);
  return difference < 0 ? `${hours}h overdue` : hours < 1 ? 'Due within 1h' : `${hours}h remaining`;
}

export default function KdpaTrackerPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('notifications')
        .select('id, incident_id, state, deadline_at, created_at, notified_at, incident:incidents(id, title, created_at, status, severity)')
        .eq('type', 'KDPA_NOTIFICATION').order('deadline_at', { ascending: true });
      if (error) setError(error.message);
      else setRecords(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-6">
          <p className="signal-label mb-2"><span className="signal-dot" />Internal tracking</p>
          <h1 className="text-2xl font-bold text-white">KDPA <span className="text-red-400">Notification Tracker</span></h1>
          <p className="text-gray-500 text-sm mt-1 max-w-3xl">Separate internal 72-hour incident-notification tracking. This is a workflow aid and is not presented as legal-compliance confirmation.</p>
        </div>
        {error && <p role="alert" className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">Tracker unavailable: {error}</p>}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead><tr className="border-b border-gray-800 bg-gray-800/50">
              {['Incident','Reference time','72-hour deadline','Remaining','State','Notification timestamp','Responsible role'].map(label => <th key={label} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {loading && <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600"><span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />Loading tracker…</span></td></tr>}
              {!loading && records.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600">No KDPA tracker records are available.</td></tr>}
              {!loading && records.map(record => (
                <tr key={record.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-4">{record.incident_id ? <Link to={`/incidents/${record.incident_id}`} className="text-red-400 hover:text-red-300 hover:underline font-medium">{record.incident?.title || record.incident_id}</Link> : <span className="text-gray-600">Incident unavailable</span>}{record.incident && <p className="text-xs text-gray-600 mt-1">{record.incident.severity} · {record.incident.status}</p>}</td>
                  <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">{formatDate(record.incident?.created_at || record.created_at)}</td>
                  <td className="px-5 py-4 text-xs text-gray-300 whitespace-nowrap">{formatDate(record.deadline_at)}</td>
                  <td className={`px-5 py-4 text-xs font-medium whitespace-nowrap ${record.state === 'PENDING' && new Date(record.deadline_at) < new Date() ? 'text-red-400' : 'text-gray-300'}`}>{timeRemaining(record.deadline_at, record.state)}</td>
                  <td className="px-5 py-4"><span className={STATE_CLASS[record.state] || 'badge-low'}>{record.state}</span></td>
                  <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">{formatDate(record.notified_at)}</td>
                  <td className="px-5 py-4 text-xs text-gray-300">SOC Lead</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
