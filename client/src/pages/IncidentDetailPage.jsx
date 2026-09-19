import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { formatPersonName } from '../lib/userDisplay.js';

const SEV_MAP    = { CRITICAL:'badge-critical', HIGH:'badge-high', MEDIUM:'badge-medium', LOW:'badge-low' };
const STATUS_MAP = { New:'status-open', Assigned:'status-in_progress', 'In Progress':'status-in_progress', Resolved:'status-resolved', Closed:'status-closed' };
const STATUSES   = ['New','Assigned','In Progress','Resolved','Closed'];
const SLA_TARGETS = { CRITICAL:4, HIGH:8, MEDIUM:24, LOW:72 };

export default function IncidentDetailPage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [incident,    setIncident]    = useState(null);
  const [comments,    setComments]    = useState([]);
  const [auditLogs,   setAuditLogs]   = useState([]);
  const [users,       setUsers]       = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [status,      setStatus]      = useState('');
  const [tab,         setTab]         = useState('comments');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [posting,     setPosting]     = useState(false);
  const [error,       setError]       = useState('');
  const channelRef = useRef(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'SOC_LEAD' ||
    (currentUser?.role === 'SOC_ANALYST' && incident?.assigned_to === currentUser?.id);

  const fmt = d => d
    ? new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : 'N/A';

  const getUserName = uid => formatPersonName(users.find(u => u.id === uid)?.name || 'Unknown');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [incRes, cmtRes, logRes, usrRes] = await Promise.all([
        supabase.from('incidents').select('*').eq('id', id).single(),
        supabase.from('comments').select('*, author:users(name)').eq('incident_id', id).order('created_at', { ascending: true }),
        supabase.from('audit_log').select('*, actor:users(name)').eq('incident_id', id).order('created_at', { ascending: false }),
        supabase.from('users').select('id, name'),
      ]);
      if (incRes.error) { setError('Incident not found or access denied.'); setLoading(false); return; }
      setIncident(incRes.data);
      setStatus(incRes.data.status);
      setComments(cmtRes.data || []);
      setAuditLogs(logRes.data || []);
      setUsers(usrRes.data || []);
      setLoading(false);
    };
    load();

    // Realtime: watch comments and incident row for this id
    channelRef.current = supabase
      .channel(`incident-detail-${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `incident_id=eq.${id}` },
        async (payload) => {
          // Fetch author name for the new comment
          const { data } = await supabase
            .from('comments')
            .select('*, author:users(name)')
            .eq('id', payload.new.id)
            .single();
          if (data) setComments(prev => [...prev.filter(c => c.id !== data.id), data]);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${id}` },
        (payload) => {
          setIncident(prev => ({ ...prev, ...payload.new }));
          setStatus(payload.new.status);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channelRef.current); };
  }, [id]);

  const handleStatusSave = async () => {
    setSaving(true);
    const old = incident.status;
    const { error } = await supabase
      .from('incidents')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { setError(error.message); setSaving(false); return; }
    await supabase.from('audit_log').insert({
      incident_id: id,
      user_id:     currentUser.id,
      action:      'STATUS_CHANGED',
      details:     `Status changed: ${old} -> ${status}`,
    });
    await supabase.from('incident_updates').insert({
      incident_id:   id,
      changed_by:    currentUser.id,
      field_changed: 'status',
      old_value:     old,
      new_value:     status,
    });
    // Optimistically update local audit list
    setAuditLogs(prev => [{
      id: Date.now(),
      action: 'STATUS_CHANGED',
      details: `Status changed: ${old} -> ${status}`,
      created_at: new Date().toISOString(),
      actor: { name: currentUser.name },
    }, ...prev]);
    setSaving(false);
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    setPosting(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({ incident_id: id, user_id: currentUser.id, body: commentBody.trim() })
      .select('*, author:users(name)')
      .single();
    if (error) { setError(error.message); setPosting(false); return; }
    // Realtime will pick it up, but also add locally in case realtime lags
    setComments(prev => [...prev.filter(c => c.id !== data.id), data]);
    setCommentBody('');
    setPosting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error && !incident) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 text-lg">{error}</p>
        <Link to="/incidents" className="text-blue-400 text-sm mt-2 inline-block hover:underline">Back to incidents</Link>
      </div>
    </div>
  );

  const target   = SLA_TARGETS[incident.severity] || 24;
  const elapsed  = (Date.now() - new Date(incident.created_at)) / 3600000;
  const slaPct   = Math.min((elapsed / target) * 100, 100);
  const slaColor = slaPct >= 100 ? 'bg-red-500' : slaPct >= 75 ? 'bg-yellow-500' : 'bg-green-500';
  const slaLabel = slaPct >= 100 ? 'SLA Breached' : slaPct >= 75 ? 'SLA At Risk' : 'Within SLA';

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6">
          <button onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 mb-4 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 font-mono mb-1">{String(incident.id || id).toUpperCase()}</p>
              <h1 className="text-xl font-bold text-white">{incident.title}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={SEV_MAP[incident.severity]}>{incident.severity}</span>
              <span className={STATUS_MAP[incident.status] || 'status-open'}>{incident.status}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: description + tabs */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Description</h3>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{incident.description}</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-800">
                {['comments', 'audit'].map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-5 py-3 text-sm font-medium transition-colors capitalize ${
                      tab === t
                        ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}>
                    {t === 'comments' ? `Comments (${comments.length})` : 'Audit Trail'}
                  </button>
                ))}
              </div>

              {tab === 'comments' && (
                <div className="p-5 space-y-4">
                  {comments.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-4">No comments yet.</p>
                  )}
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-400">
                          {(c.author?.name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-gray-200">{formatPersonName(c.author?.name || 'Unknown')}</span>
                          <span className="text-xs text-gray-600">{fmt(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1 leading-relaxed">{c.body}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <input
                      value={commentBody}
                      onChange={e => setCommentBody(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); }
                      }}
                      placeholder="Add a comment..."
                      className="input flex-1"
                    />
                    <button onClick={handleAddComment} disabled={posting || !commentBody.trim()} className="btn-primary px-4">
                      {posting
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                        : 'Post'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'audit' && (
                <div className="divide-y divide-gray-800">
                  {auditLogs.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-8">No audit entries.</p>
                  )}
                  {auditLogs.map(log => (
                    <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                      <span className="text-xs font-mono text-gray-600 shrink-0 mt-0.5 w-32">{fmt(log.created_at)}</span>
                      <div>
                        <span className="text-xs font-semibold text-blue-400 uppercase">
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">{log.details}</p>
                        <p className="text-xs text-gray-600">by {formatPersonName(log.actor?.name || 'System')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: sidebar */}
          <div className="space-y-4">
            {canEdit && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Update Status</h3>
                <select value={status} onChange={e => setStatus(e.target.value)} className="select w-full">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={handleStatusSave}
                  disabled={saving || status === incident.status}
                  className="btn-primary w-full mt-3 text-sm flex items-center justify-center gap-2"
                >
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                    : 'Save Changes'}
                </button>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</h3>
              {[
                { label: 'Category',       value: incident.category?.replace(/_/g, ' ') },
                { label: 'Affected Asset', value: incident.affected_asset || 'N/A' },
                { label: 'Source IP',      value: incident.source_ip     || 'N/A' },
                { label: 'Created By',     value: getUserName(incident.created_by) },
                { label: 'Assigned To',    value: getUserName(incident.assigned_to) || 'Unassigned' },
                { label: 'Created',        value: fmt(incident.created_at) },
                { label: 'Last Updated',   value: fmt(incident.updated_at) },
                { label: 'Resolved At',    value: incident.resolved_at ? fmt(incident.resolved_at) : '\u2014' },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-gray-600 mb-0.5">{row.label}</p>
                  <p className="text-sm text-gray-300 font-medium">{row.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">SLA Status</h3>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{slaLabel}</span>
                <span>Target: {target}h</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className={`h-2 rounded-full ${slaColor} transition-all`} style={{ width: `${slaPct}%` }} />
              </div>
              <p className="text-xs text-gray-600 mt-1">{Math.round(elapsed)}h elapsed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
