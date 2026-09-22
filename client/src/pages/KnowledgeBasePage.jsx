import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { abbreviatedName } from '../lib/formatters.js';

const CATEGORIES = ['PHISHING','MALWARE','UNAUTHORISED_ACCESS','DOS','OTHER'];

export default function KnowledgeBasePage() {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles,  setArticles]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [category,  setCategory]  = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState({ title:'', summary:'', content:'', category:'PHISHING', tags:'' });
  const [saving,    setSaving]    = useState(false);

  const canCreate = currentUser?.role === 'ADMIN' || currentUser?.role === 'SOC_LEAD';
  const sourceIncidentId = searchParams.get('source_incident');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kb_articles')
      .select('*, author:users(name)')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setArticles(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!sourceIncidentId || !canCreate) return;
    (async () => {
      const { data, error } = await supabase.from('incidents').select('id, title, category, severity').eq('id', sourceIncidentId).single();
      if (error) { setError('The source incident is unavailable for conversion.'); return; }
      setForm(current => ({
        ...current,
        title: current.title || `Response guidance: ${data.title}`,
        summary: current.summary || 'Manager-reviewed knowledge-base article derived from an incident record.',
        category: data.category || current.category,
        tags: current.tags || [data.severity, data.category].filter(Boolean).join(', '),
      }));
      setShowForm(true);
    })();
  }, [sourceIncidentId, canCreate]);

  const handle = e => setForm(f => ({...f, [e.target.name]: e.target.value}));

  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('kb_articles').insert({
      title:    form.title,
      summary:  form.summary,
      content:  form.content,
      category: form.category,
      tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      author_id: currentUser.id,
      source_incident_id: sourceIncidentId || null,
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setShowForm(false);
    setForm({ title:'', summary:'', content:'', category:'PHISHING', tags:'' });
    setSearchParams({});
    await load();
    setSaving(false);
  };

  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '';

  const filtered = articles.filter(a =>
    (!search   || a.title?.toLowerCase().includes(search.toLowerCase()) || a.summary?.toLowerCase().includes(search.toLowerCase()) || a.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase())))
    && (!category || a.category === category)
  );

  const CAT_COLORS = { PHISHING:'bg-red-500/15 text-red-300', MALWARE:'bg-red-500/20 text-red-400', UNAUTHORISED_ACCESS:'bg-red-950 text-red-300', DOS:'bg-gray-700 text-gray-200', OTHER:'bg-gray-800 text-gray-400' };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Knowledge <span className="text-red-400">Base</span></h1>
            <p className="text-gray-500 text-sm mt-0.5">{articles.length} articles &bull; SOC playbooks and threat intelligence</p>
          </div>
          {canCreate && (
            <button onClick={()=>{ setShowForm(v=>!v); if (sourceIncidentId) setSearchParams({}); }} className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              New Article
            </button>
          )}
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-300">New Article</h3>
              {sourceIncidentId && <p className="text-xs text-gray-500 mt-1">Source incident retained for traceability. Review and redact the article before publishing; incident narrative is not copied automatically.</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                <input name="title" value={form.title} onChange={handle} required placeholder="Article title" className="input w-full" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">Summary</label>
                <input name="summary" value={form.summary} onChange={handle} required placeholder="One-line summary" className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                <select name="category" value={form.category} onChange={handle} className="select w-full">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tags</label>
                <input name="tags" value={form.tags} onChange={handle} placeholder="endpoint, containment, windows" className="input w-full" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">Content (Markdown supported)</label>
                <textarea name="content" value={form.content} onChange={handle} required rows={8} placeholder="Full article body..." className="input w-full resize-none font-mono text-xs" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Publishing...</> : 'Publish'}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); if (sourceIncidentId) setSearchParams({}); }} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search articles..." className="input pl-9 w-full" />
            </div>
            <select value={category} onChange={e=>setCategory(e.target.value)} className="select w-full">
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <span className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-600">No articles found.{canCreate && <button type="button" className="text-red-400 ml-1" onClick={()=>setShowForm(true)}>Create the first one.</button>}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(a => (
              <Link key={a.id} to={`/knowledge-base/${a.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-red-600/50 hover:bg-gray-800/50 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${CAT_COLORS[a.category]||'bg-gray-500/20 text-gray-400'}`}>
                    {a.category?.replace(/_/g,' ')}
                  </span>
                  <span className="text-xs text-gray-600">{fmt(a.created_at)}</span>
                </div>
                <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-white leading-tight">{a.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{a.summary}</p>
                {a.tags?.length > 0 && <p className="text-xs text-gray-500 mt-3">{a.tags.slice(0, 3).join(' · ')}</p>}
                <p className="text-xs text-gray-600 mt-2">by {abbreviatedName(a.author?.name)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
