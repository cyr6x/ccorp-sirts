import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

const CATEGORIES = ['PHISHING','MALWARE','UNAUTHORISED_ACCESS','DOS','OTHER'];
const SEVERITIES = ['CRITICAL','HIGH','MEDIUM','LOW'];

export default function NewIncidentPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title:'', description:'', category:'PHISHING', severity:'MEDIUM', source_ip:'', affected_asset:'' });
  const [assets, setAssets] = useState([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handle = e => setForm(f => ({...f, [e.target.name]: e.target.value}));

  useEffect(() => {
    supabase.from('assets').select('id, name, type, ip_address').eq('status', 'ACTIVE').order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setAssets(data || []);
      });
  }, []);

  const toggleAsset = assetId => setSelectedAssetIds(current =>
    current.includes(assetId) ? current.filter(id => id !== assetId) : [...current, assetId]
  );

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { data, error } = await supabase.rpc('create_incident_with_assets', {
      p_title: form.title,
      p_description: form.description,
      p_category: form.category,
      p_severity: form.severity,
      p_source_ip: form.source_ip.trim() || null,
      p_affected_asset: form.affected_asset,
      p_asset_ids: selectedAssetIds,
    });
    if (error) { setError(error.message); setSubmitting(false); return; }
    navigate(`/incidents/${data}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={()=>navigate(-1)} className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 mb-3 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-white">New <span className="text-red-400">Incident</span></h1>
          <p className="text-gray-500 text-sm mt-1">Log a new security incident for investigation</p>
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <div>
            <label htmlFor="incident-title" className="block text-sm font-medium text-gray-300 mb-1">Title <span className="text-red-400">*</span></label>
            <input id="incident-title" name="title" value={form.title} onChange={handle} required placeholder="Brief incident title" className="input w-full" />
          </div>
          <div>
            <label htmlFor="incident-description" className="block text-sm font-medium text-gray-300 mb-1">Description <span className="text-red-400">*</span></label>
            <textarea id="incident-description" name="description" value={form.description} onChange={handle} required rows={5} placeholder="Detailed description of the incident..." className="input w-full resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
              <select name="category" value={form.category} onChange={handle} className="select w-full">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Severity</label>
              <select name="severity" value={form.severity} onChange={handle} className="select w-full">
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Source IP</label>
              <input name="source_ip" value={form.source_ip} onChange={handle} placeholder="e.g. 192.168.1.1" className="input w-full font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Unregistered Asset</label>
              <input name="affected_asset" value={form.affected_asset} onChange={handle} placeholder="Only if it is not in inventory" className="input w-full font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Affected Assets</label>
            <input value={assetSearch} onChange={event => setAssetSearch(event.target.value)} placeholder="Search active asset inventory" className="input w-full mb-2" />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950/50 divide-y divide-gray-800">
              {assets.filter(asset => `${asset.name} ${asset.type || ''} ${asset.ip_address || ''}`.toLowerCase().includes(assetSearch.toLowerCase())).map(asset => (
                <label key={asset.id} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.03] cursor-pointer">
                  <input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={() => toggleAsset(asset.id)} className="accent-red-600" />
                  <span className="flex-1">{asset.name}</span>
                  <span className="text-xs text-gray-600 font-mono">{asset.ip_address || asset.type || ''}</span>
                </label>
              ))}
              {assets.length === 0 && <p className="px-3 py-4 text-sm text-gray-600">No active assets are registered yet.</p>}
            </div>
            <p className="mt-1 text-xs text-gray-600">{selectedAssetIds.length} selected</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {submitting ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</> : 'Create Incident'}
            </button>
            <button type="button" onClick={()=>navigate(-1)} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
