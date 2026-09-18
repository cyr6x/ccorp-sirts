import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

const CATEGORIES = ['PHISHING','MALWARE','UNAUTHORISED_ACCESS','DOS','OTHER'];
const SEVERITIES = ['CRITICAL','HIGH','MEDIUM','LOW'];

export default function NewIncidentPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title:'', description:'', category:'PHISHING', severity:'MEDIUM', source_ip:'', affected_asset:'' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handle = e => setForm(f => ({...f, [e.target.name]: e.target.value}));

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { data, error } = await supabase.from('incidents').insert({
      title:          form.title,
      description:    form.description,
      category:       form.category,
      severity:       form.severity,
      source_ip:      form.source_ip || null,
      affected_asset: form.affected_asset || null,
      status:         'New',
      created_by:     currentUser.id,
      assigned_to:    null,
    }).select().single();
    if (error) { setError(error.message); setSubmitting(false); return; }
    // Log to audit_log
    await supabase.from('audit_log').insert({
      incident_id: data.id,
      user_id:     currentUser.id,
      action:      'INCIDENT_CREATED',
      details:     `Incident created with severity ${form.severity}`,
    });
    navigate(`/incidents/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={()=>navigate(-1)} className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 mb-3 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-white">New <span className="text-blue-400">Incident</span></h1>
          <p className="text-gray-500 text-sm mt-1">Log a new security incident for investigation</p>
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title <span className="text-red-400">*</span></label>
            <input name="title" value={form.title} onChange={handle} required placeholder="Brief incident title" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description <span className="text-red-400">*</span></label>
            <textarea name="description" value={form.description} onChange={handle} required rows={5} placeholder="Detailed description of the incident..." className="input w-full resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Affected Asset</label>
              <input name="affected_asset" value={form.affected_asset} onChange={handle} placeholder="e.g. WEB-PROD-01" className="input w-full font-mono" />
            </div>
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
