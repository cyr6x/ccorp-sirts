import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { hasCapability } from '../lib/rbac.js';

const ASSET_TYPES   = ['SERVER','WORKSTATION','NETWORK_DEVICE','DATABASE','APPLICATION','OTHER'];
const ASSET_STATUS  = ['ACTIVE','MONITORING','ISOLATED','RETIRED'];
const RISK_LEVELS   = ['LOW','MEDIUM','HIGH','CRITICAL'];

const RISK_COLORS   = { LOW:'badge-low', MEDIUM:'badge-medium', HIGH:'badge-high', CRITICAL:'badge-critical' };
const STATUS_COLORS = { ACTIVE:'text-green-400', MONITORING:'text-yellow-400', ISOLATED:'text-red-400', RETIRED:'text-gray-500' };

export default function AssetsPage() {
  const { currentUser } = useAuth();
  const [assets,   setAssets]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [typeF,    setTypeF]    = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ name:'', type:'SERVER', ip_address:'', os:'', owner:'', risk_level:'LOW', status:'ACTIVE', notes:'' });
  const [saving,   setSaving]   = useState(false);

  const canManage = hasCapability(currentUser?.role, 'assets.manage');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setAssets(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handle = e => setForm(f => ({...f, [e.target.name]: e.target.value}));

  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('assets').insert(form);
    if (error) { setError(error.message); setSaving(false); return; }
    setShowForm(false);
    setForm({ name:'', type:'SERVER', ip_address:'', os:'', owner:'', risk_level:'LOW', status:'ACTIVE', notes:'' });
    await load();
    setSaving(false);
  };

  const handleStatusChange = async (id, newStatus) => {
    const { error } = await supabase.from('assets').update({ status: newStatus }).eq('id', id);
    if (error) { setError(error.message); return; }
    setAssets(prev => prev.map(a => a.id === id ? {...a, status: newStatus} : a));
  };

  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) : 'N/A';

  const filtered = assets.filter(a =>
    (!search  || a.name?.toLowerCase().includes(search.toLowerCase()) || a.ip_address?.includes(search) || a.owner?.toLowerCase().includes(search.toLowerCase()))
    && (!typeF   || a.type   === typeF)
    && (!statusF || a.status === statusF)
  );

  const stats = {
    total:    assets.length,
    active:   assets.filter(a => a.status === 'ACTIVE').length,
    critical: assets.filter(a => a.risk_level === 'CRITICAL').length,
    high:     assets.filter(a => a.risk_level === 'HIGH').length,
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Asset inventory</h1>
            <p className="text-gray-500 text-sm mt-0.5">{assets.length} registered assets</p>
          </div>
          {canManage && (
            <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Asset
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[{l:'Total Assets',l2:stats.total,c:'text-white'},{l:'Active',l2:stats.active,c:'text-green-400'},{l:'Critical Risk',l2:stats.critical,c:'text-red-400'},{l:'High Risk',l2:stats.high,c:'text-orange-400'}].map(s => (
            <div key={s.l} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{s.l}</p>
              <p className={`text-2xl font-bold mt-1 ${s.c}`}>{s.l2}</p>
            </div>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Register New Asset</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Asset Name <span className="text-red-400">*</span></label><input name="name" value={form.name} onChange={handle} required placeholder="WEB-PROD-01" className="input w-full" /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Type</label><select name="type" value={form.type} onChange={handle} className="select w-full">{ASSET_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">IP Address</label><input name="ip_address" value={form.ip_address} onChange={handle} placeholder="192.168.1.10" className="input w-full font-mono" /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">OS / Platform</label><input name="os" value={form.os} onChange={handle} placeholder="Ubuntu 22.04" className="input w-full" /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Owner / Team</label><input name="owner" value={form.owner} onChange={handle} placeholder="Infrastructure" className="input w-full" /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Risk Level</label><select name="risk_level" value={form.risk_level} onChange={handle} className="select w-full">{RISK_LEVELS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1">Status</label><select name="status" value={form.status} onChange={handle} className="select w-full">{ASSET_STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-400 mb-1">Notes</label><input name="notes" value={form.notes} onChange={handle} placeholder="Optional notes" className="input w-full" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">{saving?<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>:'Register Asset'}</button>
              <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets..." className="input pl-9 w-full" />
            </div>
            <select value={typeF}   onChange={e=>setTypeF(e.target.value)}   className="select w-full"><option value="">All Types</option>{ASSET_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select>
            <select value={statusF} onChange={e=>setStatusF(e.target.value)} className="select w-full"><option value="">All Statuses</option>{ASSET_STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">IP</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Owner</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              {canManage && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {loading && <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600 text-sm"><span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />Loading...</span></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600 text-sm">No assets found.</td></tr>}
              {!loading && filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-4"><p className="font-medium text-gray-100">{a.name}</p>{a.os && <p className="text-xs text-gray-500">{a.os}</p>}</td>
                  <td className="px-5 py-4 hidden md:table-cell"><span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{a.type?.replace(/_/g,' ')}</span></td>
                  <td className="px-5 py-4 hidden lg:table-cell text-xs font-mono text-gray-400">{a.ip_address||'\u2014'}</td>
                  <td className="px-5 py-4 hidden lg:table-cell text-xs text-gray-400">{a.owner||'\u2014'}</td>
                  <td className="px-5 py-4"><span className={RISK_COLORS[a.risk_level]}>{a.risk_level}</span></td>
                  <td className="px-5 py-4"><span className={`text-xs font-medium ${STATUS_COLORS[a.status]||'text-gray-400'}`}>{a.status}</span></td>
                  {canManage && <td className="px-5 py-4">
                    <select value={a.status} onChange={e=>handleStatusChange(a.id,e.target.value)} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 focus:outline-none focus:border-red-500">
                      {ASSET_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
