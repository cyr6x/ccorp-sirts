import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { abbreviatedName } from '../lib/formatters.js';
import { buildIncidentCsv } from '../lib/reportExport.js';
import { createRequestGate, reportFilterKey, loadFilteredReports } from '../lib/reportRequestState.js';

const RANGES = [{ label:'Last 7 days', value:'7' }, { label:'Last 30 days', value:'30' }, { label:'Last 90 days', value:'90' }, { label:'All time', value:'all' }];
const SEV_COLORS = { CRITICAL:'#ef1b24', HIGH:'#c8141c', MEDIUM:'#73737b', LOW:'#b9b9be' };
const CAT_COLORS = ['#ef1b24','#c8141c','#991b1b','#73737b','#b9b9be'];
const STATUSES = ['New','Assigned','In Progress','Resolved','Closed'];
const SEVERITIES = ['CRITICAL','HIGH','MEDIUM','LOW'];

function SummaryCard({ label, value, emphasis = false }) {
  return (
    <div className={`border rounded-xl p-5 ${emphasis ? 'bg-red-500/5 border-red-500/30' : 'bg-gray-900 border-gray-800'}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${emphasis ? 'text-red-400' : 'text-white'}`}>{value ?? '\u2014'}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [range,     setRange]     = useState('30');
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [users,     setUsers]     = useState([]);
  const [status,    setStatus]    = useState('');
  const [severity,  setSeverity]  = useState('');
  const [assignee,  setAssignee]  = useState('');
  const [loadedFilterKey, setLoadedFilterKey] = useState('');
  const requestGate = useRef(createRequestGate());
  const filterKey = reportFilterKey({ range, status, severity, assignee });

  useEffect(() => {
    supabase.from('users').select('id, name').order('name').then(({ data, error }) => {
      if (error) setError(error.message);
      else setUsers(data || []);
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      setIncidents([]);
      setLoadedFilterKey('');
      let query = supabase.from('incidents').select('*, assigned_to_user:users!incidents_assigned_to_fkey(name), incident_assets(asset:assets(name, ip_address))').order('created_at', { ascending: false });
      if (range !== 'all') {
        const since = new Date(Date.now() - parseInt(range) * 86400000).toISOString();
        query = query.gte('created_at', since);
      }
      if (status) query = query.eq('status', status);
      if (severity) query = query.eq('severity', severity);
      if (assignee === 'unassigned') query = query.is('assigned_to', null);
      else if (assignee) query = query.eq('assigned_to', assignee);
      await loadFilteredReports(requestGate.current, filterKey, () => query, ({ data, error }) => {
        if (!active) return;
        if (error) {
          setError('Reports could not be loaded. Please retry the filters.');
          setIncidents([]);
          setLoadedFilterKey('');
        } else {
          setIncidents(data || []);
          setLoadedFilterKey(filterKey);
        }
        setLoading(false);
      });
    })();
    return () => { active = false; };
  }, [range, status, severity, assignee, filterKey]);

  const agg = (field) => incidents.reduce((acc, i) => {
    const k = i[field] || 'Unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const bySeverity = Object.entries(agg('severity')).map(([name, value]) => ({ name, value }));
  const byStatus   = Object.entries(agg('status')).map(([name, value]) => ({ name, value }));
  const byCategory = Object.entries(agg('category')).map(([name, value]) => ({ name: name.replace(/_/g,' '), value }));
  const byMonth = Object.entries(incidents.reduce((acc, incident) => {
    const month = new Date(incident.created_at).toLocaleDateString('en-GB', { month:'short', year:'2-digit' });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {})).reverse().map(([month, count]) => ({ month, count }));

  const analystPerformance = Object.values(incidents.reduce((acc, incident) => {
    const key = incident.assigned_to || 'unassigned';
    if (!acc[key]) acc[key] = { id:key, name:incident.assigned_to_user?.name || 'Unassigned', total:0, resolved:0, resolutionMs:0 };
    acc[key].total += 1;
    if (incident.resolved_at) {
      acc[key].resolved += 1;
      acc[key].resolutionMs += new Date(incident.resolved_at) - new Date(incident.created_at);
    }
    return acc;
  }, {})).sort((a, b) => b.total - a.total);

  const resolved = incidents.filter(i => i.resolved_at);
  const mttr = resolved.length
    ? Math.round(resolved.reduce((sum, i) => sum + (new Date(i.resolved_at) - new Date(i.created_at)), 0) / resolved.length / 3600000)
    : null;

  const critical = incidents.filter(i => i.severity === 'CRITICAL').length;
  const open     = incidents.filter(i => i.status !== 'Resolved' && i.status !== 'Closed').length;
  const breached = incidents.filter(i => {
    const targets = { CRITICAL:4, HIGH:8, MEDIUM:24, LOW:72 };
    const t = targets[i.severity];
    return i.status !== 'Resolved' && i.status !== 'Closed' && t && ((Date.now() - new Date(i.created_at)) / 3600000) > t;
  }).length;

  const currentResults = !loading && !error && loadedFilterKey === filterKey;
  const exportReady = currentResults && incidents.length > 0;

  const exportCsv = () => {
    if (!exportReady) return;
    const csv = buildIncidentCsv(incidents);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sirts-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Reports <span className="text-red-400">&amp; Analytics</span></h1>
            <p className="text-gray-500 text-sm mt-0.5">Incident metrics for the selected period</p>
          </div>
          <button type="button" onClick={exportCsv} disabled={!exportReady} className="btn-primary disabled:opacity-50" aria-describedby="report-export-status">Export CSV</button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select aria-label="Report period" value={range} onChange={event => setRange(event.target.value)} className="select">{RANGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select aria-label="Incident status" value={status} onChange={event => setStatus(event.target.value)} className="select"><option value="">All statuses</option>{STATUSES.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Incident severity" value={severity} onChange={event => setSeverity(event.target.value)} className="select"><option value="">All severities</option>{SEVERITIES.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Assigned analyst" value={assignee} onChange={event => setAssignee(event.target.value)} className="select"><option value="">All assignees</option><option value="unassigned">Unassigned</option>{users.map(user => <option key={user.id} value={user.id}>{abbreviatedName(user.name)}</option>)}</select>
          <button type="button" onClick={() => { setRange('30'); setStatus(''); setSeverity(''); setAssignee(''); }} className="text-sm text-gray-300 underline underline-offset-2">Reset filters</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
        <p id="report-export-status" className="sr-only">{exportReady ? 'Current filtered results are ready for export.' : 'Export is disabled until the current filter results have loaded successfully.'}</p>

        {!currentResults && !error ? (
          <div role="status" aria-label="Loading current report results" className="flex items-center justify-center h-64">
            <span className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? null : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard label="Total Incidents" value={incidents.length} />
              <SummaryCard label="Open"            value={open} />
              <SummaryCard label="Critical"        value={critical} emphasis />
              <SummaryCard label="SLA Breached"    value={breached} emphasis />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard label="Resolved"        value={resolved.length} />
              <SummaryCard label="MTTR (hours)"    value={mttr != null ? `${mttr}h` : 'N/A'} />
              <SummaryCard label="Resolution Rate" value={incidents.length ? `${Math.round(resolved.length/incidents.length*100)}%` : 'N/A'} />
              <SummaryCard label="Avg/Day"         value={range !== 'all' ? (incidents.length / parseInt(range)).toFixed(1) : 'N/A'} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">By Severity</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bySeverity} margin={{top:0,right:0,bottom:0,left:-20}}>
                    <XAxis dataKey="name" tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #1f2937',borderRadius:'8px',color:'#f9fafb'}} />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {bySeverity.map((e,i) => <Cell key={i} fill={SEV_COLORS[e.name]||'#73737b'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">By Status</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byStatus} margin={{top:0,right:0,bottom:0,left:-20}}>
                    <XAxis dataKey="name" tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #1f2937',borderRadius:'8px',color:'#f9fafb'}} />
                    <Bar dataKey="value" fill="#ef1b24" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">By Category</h3>
              {byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" label={({name,percent})=>`${name} (${(percent*100).toFixed(0)}%)`} labelLine={{stroke:'#374151'}}>
                      {byCategory.map((_,i) => <Cell key={i} fill={CAT_COLORS[i%CAT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #1f2937',borderRadius:'8px',color:'#f9fafb'}} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:'12px',color:'#9ca3af'}} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No data for this period</p>}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Monthly Trend</h3>
                {byMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byMonth} margin={{top:0,right:0,bottom:0,left:-20}}>
                      <XAxis dataKey="month" tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{background:'#111827',border:'1px solid #1f2937',borderRadius:'8px',color:'#f9fafb'}} />
                      <Bar dataKey="count" fill="#ef1b24" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-600 text-sm text-center py-12">No trend data for this period</p>}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-800"><h3 className="text-sm font-semibold text-gray-300">Analyst Performance</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-800/40 text-xs uppercase tracking-wider text-gray-500">
                      <th className="text-left px-5 py-3">Analyst</th><th className="text-right px-5 py-3">Total</th><th className="text-right px-5 py-3">Resolved</th><th className="text-right px-5 py-3">Avg. hours</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-800">
                      {analystPerformance.map(analyst => (
                        <tr key={analyst.id}>
                          <td className="px-5 py-3 text-gray-300">{analyst.id === 'unassigned' ? analyst.name : abbreviatedName(analyst.name)}</td>
                          <td className="px-5 py-3 text-right text-gray-400 font-mono">{analyst.total}</td>
                          <td className="px-5 py-3 text-right text-gray-400 font-mono">{analyst.resolved}</td>
                          <td className="px-5 py-3 text-right text-gray-400 font-mono">{analyst.resolved ? Math.round(analyst.resolutionMs / analyst.resolved / 3600000) : '\u2014'}</td>
                        </tr>
                      ))}
                      {analystPerformance.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-600">No analyst data for this period</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
