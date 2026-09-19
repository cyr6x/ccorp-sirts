import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { formatPersonName } from '../lib/userDisplay.js';

const CAT_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];
const SEV_MAP    = { CRITICAL:'badge-critical', HIGH:'badge-high', MEDIUM:'badge-medium', LOW:'badge-low' };
const STATUS_MAP = { New:'status-open', Assigned:'status-in_progress', 'In Progress':'status-in_progress', Resolved:'status-resolved', Closed:'status-closed' };

function StatCard({ label, value, sub, icon, accent }) {
  const colors = { red:'border-red-500/30 bg-red-500/5', blue:'border-blue-500/30 bg-blue-500/5', green:'border-green-500/30 bg-green-500/5', yellow:'border-yellow-500/30 bg-yellow-500/5' };
  return (
    <div className={`rounded-xl border p-5 ${colors[accent]||colors.blue} transition-all hover:scale-[1.02]`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value ?? '\u2014'}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className="text-2xl opacity-60">{icon}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [stats,   setStats]   = useState({ open:0, critical:0, thisWeek:0, mttr:null });
  const [catData, setCatData] = useState([]);
  const [dayData, setDayData] = useState([]);
  const [recent,  setRecent]  = useState([]);
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();

      const [openRes, critRes, weekRes, resolvedRes, allRes, notifRes] = await Promise.all([
        supabase.from('incidents').select('*', { count:'exact', head:true }).not('status', 'in', '("Resolved","Closed")'),
        supabase.from('incidents').select('*', { count:'exact', head:true }).eq('severity','CRITICAL'),
        supabase.from('incidents').select('*', { count:'exact', head:true }).gte('created_at', weekAgo),
        supabase.from('incidents').select('created_at, resolved_at').not('resolved_at','is',null),
        supabase.from('incidents').select('id, title, severity, status, category, created_at, affected_asset, assigned_to_user:users!incidents_assigned_to_fkey(name)').order('created_at',{ascending:false}).limit(8),
        supabase.from('notifications').select('*').lt('deadline_at', new Date(Date.now()+12*60*60*1000).toISOString()).eq('notified',false),
      ]);

      const failures = [openRes, critRes, weekRes, resolvedRes, allRes, notifRes]
        .filter(result => result?.error)
        .map(result => result.error.message);

      if (failures.length) {
        setError('Some dashboard data could not be loaded. The workspace remains available while the development database is being isolated.');
      }

      // MTTR
      let mttr = null;
      if (resolvedRes.data?.length) {
        const total = resolvedRes.data.reduce((sum,i) => sum + (new Date(i.resolved_at)-new Date(i.created_at)),0);
        mttr = Math.round(total / resolvedRes.data.length / 3600000);
      }

      setStats({ open: openRes.count||0, critical: critRes.count||0, thisWeek: weekRes.count||0, mttr });
      setRecent(allRes.data||[]);
      setAlerts(notifRes.data||[]);

      // By-category aggregation
      if (allRes.data) {
        const byCat = allRes.data.reduce((acc,i) => { acc[i.category]=(acc[i.category]||0)+1; return acc; },{});
        setCatData(Object.entries(byCat).map(([name,value])=>({ name:name.replace(/_/g,' '), value })));
      }

      // By-day last 7
      if (allRes.data) {
        const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const now=Date.now();
        const bd = Array.from({length:7},(_,k)=>{
          const d=new Date(now-(6-k)*86400000);
          const count=allRes.data.filter(i=>new Date(i.created_at).toDateString()===d.toDateString()).length;
          return { day:days[d.getDay()], count };
        });
        setDayData(bd);
      }

      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-[0.12em] text-white">SIRTS</h1>
            <span className="text-[10px] uppercase tracking-[0.18em] text-red-400">Overview</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">Welcome back, {formatPersonName(currentUser?.name)} &bull; {new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <p className="text-sm font-medium text-amber-200">{error}</p>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700/50 rounded-xl">
            <p className="text-sm font-semibold text-red-400 mb-2">KDPA Deadline Alert &mdash; {alerts.length} incident{alerts.length>1?'s':''} nearing 72h notification deadline</p>
            <div className="space-y-1">
              {alerts.map(a => (
                <p key={a.id} className="text-xs text-red-300">Incident ID: {a.incident_id} &mdash; Deadline: {new Date(a.deadline_at).toLocaleString('en-GB')}</p>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64"><span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Open Incidents"  value={stats.open}     sub="Require attention"       icon="\uD83D\uDEA8" accent="red" />
              <StatCard label="Critical"        value={stats.critical} sub="Highest severity"        icon="\u26A0\uFE0F" accent="red" />
              <StatCard label="This Week"       value={stats.thisWeek} sub="New incidents (7 days)"  icon="\uD83D\uDCC5" accent="blue" />
              <StatCard label="Avg Resolution"  value={stats.mttr!=null?`${stats.mttr}h`:'N/A'} sub="Mean time to resolve" icon="\u23F1\uFE0F" accent="green" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
              <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Incidents by Day (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dayData} margin={{top:0,right:0,bottom:0,left:-20}}>
                    <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#6b7280',fontSize:11}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{background:'#111827',border:'1px solid #1f2937',borderRadius:'8px',color:'#f9fafb'}} cursor={{fill:'rgba(59,130,246,0.05)'}} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">By Category</h3>
                {catData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {catData.map((_,i)=><Cell key={i} fill={CAT_COLORS[i%CAT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{background:'#111827',border:'1px solid #1f2937',borderRadius:'8px',color:'#f9fafb'}} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:'11px',color:'#9ca3af'}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-600 text-sm text-center pt-12">No data yet</p>}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Recent Incidents</h3>
                <Link to="/incidents" className="text-xs text-blue-400 hover:text-blue-300 font-medium">View all &rarr;</Link>
              </div>
              <div className="divide-y divide-gray-800">
                {recent.length===0 && <p className="text-gray-600 text-sm text-center py-8">No incidents yet.</p>}
                {recent.map(inc => (
                  <Link key={inc.id} to={`/incidents/${inc.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-100 truncate group-hover:text-white">{inc.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{inc.category?.replace(/_/g,' ')} &bull; {inc.affected_asset||'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500 hidden lg:block">{inc.assigned_to_user?.name||<span className="italic">Unassigned</span>}</span>
                      <span className={SEV_MAP[inc.severity]}>{inc.severity}</span>
                      <span className={STATUS_MAP[inc.status]||'status-open'}>{inc.status}</span>
                    </div>
                    <span className="text-gray-600 group-hover:text-gray-400">&rsaquo;</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
