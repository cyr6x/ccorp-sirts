import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const RANGES = [{ label:'Last 7 days', value:'7' }, { label:'Last 30 days', value:'30' }, { label:'Last 90 days', value:'90' }, { label:'All time', value:'all' }];
const SEV_COLORS = { CRITICAL:'#ef4444', HIGH:'#f97316', MEDIUM:'#eab308', LOW:'#22c55e' };
const CAT_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];

export default function ReportsPage() {
  const [range,     setRange]     = useState('30');
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase.from('incidents').select('*').order('created_at', { ascending: false });
      if (range !== 'all') {
        const since = new Date(Date.now() - parseInt(range) * 86400000).toISOString();
        query = query.gte('created_at', since);
      }
      const { data, error } = await query;
      if (error) setError(error.message);
      else setIncidents(data || []);
      setLoading(false);
    })();
  }, [range]);

  const agg = (field) => incidents.reduce((acc, i) => {
    const k = i[field] || 'Unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const bySeverity = Object.entries(agg('severity')).map(([name, value]) => ({ name, value }));
  const byStatus   = Object.entries(agg('status')).map(([name, value]) => ({ name, value }));
  const byCategory = Object.entries(agg('category')).map(([name, value]) => ({ name: name.replace(/_/g,' '), value }));

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

  const SummaryCard = ({ label, value, color }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color || 'text-white'}`}>{value ?? '\u2014'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Reports <span className="text-blue-400">&amp; Analytics</span></h1>
            <p className="text-gray-500 text-sm mt-0.5">Incident metrics for the selected period</p>
          </div>
          <select value={range} onChange={e=>setRange(e.target.value)} className="select">
            {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard label="Total Incidents" value={incidents.length} />
              <SummaryCard label="Open"            value={open}            color="text-yellow-400" />
              <SummaryCard label="Critical"        value={critical}        color="text-red-400" />
              <SummaryCard label="SLA Breached"    value={breached}        color="text-red-500" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard label="Resolved"        value={resolved.length} color="text-green-400" />
              <SummaryCard label="MTTR (hours)"    value={mttr != null ? `${mttr}h` : 'N/A'} color="text-blue-400" />
              <SummaryCard label="Resolution Rate" value={incidents.length ? `${Math.round(resolved.length/incidents.length*100)}%` : 'N/A'} color="text-purple-400" />
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
                      {bySeverity.map((e,i) => <Cell key={i} fill={SEV_COLORS[e.name]||'#3b82f6'} />)}
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
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4,4,0,0]} />
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
          </>
        )}
      </div>
    </div>
  );
}
