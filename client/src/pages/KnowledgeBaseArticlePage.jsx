import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function KnowledgeBaseArticlePage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({ title:'', summary:'', content:'', category:'' });
  const [saving,  setSaving]  = useState(false);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'SOC_LEAD';

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('kb_articles')
        .select('*, author:users(name)')
        .eq('id', id)
        .single();
      if (error) setError('Article not found.');
      else { setArticle(data); setForm({ title:data.title, summary:data.summary, content:data.content, category:data.category }); }
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('kb_articles').update(form).eq('id', id).select('id').single();
    if (error) { setError(error.message); setSaving(false); return; }
    setArticle(prev => ({...prev, ...form}));
    setEditing(false);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this article? This cannot be undone.')) return;
    const { error } = await supabase.from('kb_articles').delete().eq('id', id).select('id').single();
    if (error) { setError(error.message); return; }
    navigate('/knowledge-base');
  };

  const CATEGORIES = ['PHISHING','MALWARE','UNAUTHORISED_ACCESS','DOS','OTHER'];
  const CAT_COLORS = { PHISHING:'bg-orange-500/20 text-orange-400', MALWARE:'bg-red-500/20 text-red-400', UNAUTHORISED_ACCESS:'bg-purple-500/20 text-purple-400', DOS:'bg-yellow-500/20 text-yellow-400', OTHER:'bg-gray-500/20 text-gray-400' };
  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '';

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (error)   return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-center"><p className="text-gray-400">{error}</p><Link to="/knowledge-base" className="text-blue-400 text-sm mt-2 inline-block">Back to Knowledge Base</Link></div></div>;

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button onClick={()=>navigate(-1)} className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 mb-4 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          {editing ? (
            <div className="space-y-4">
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="input w-full text-xl font-bold" />
              <input value={form.summary} onChange={e=>setForm(f=>({...f,summary:e.target.value}))} className="input w-full text-sm" placeholder="Summary" />
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="select">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
              <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={20} className="input w-full font-mono text-xs resize-none" />
              <div className="flex gap-3">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : 'Save'}
                </button>
                <button onClick={()=>setEditing(false)} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium mb-3 inline-block ${CAT_COLORS[article.category]||'bg-gray-500/20 text-gray-400'}`}>{article.category?.replace(/_/g,' ')}</span>
                  <h1 className="text-2xl font-bold text-white mt-1">{article.title}</h1>
                  <p className="text-gray-400 text-sm mt-2">{article.summary}</p>
                  <p className="text-xs text-gray-600 mt-2">by {article.author?.name || 'Unknown'} &bull; {fmt(article.created_at)}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={()=>setEditing(true)} className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 text-xs transition-colors">Edit</button>
                    <button onClick={handleDelete} className="px-3 py-1.5 rounded-lg border border-red-700/50 text-red-400 hover:bg-red-900/20 text-xs transition-colors">Delete</button>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-800 pt-6">
                <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{article.content}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
