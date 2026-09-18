import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  allowedStatusesFor,
  assignmentTargetsFor,
  canChangeStatus,
  canClaimIncident,
  canEscalateIncident,
  hasCapability,
  isSeniorIncidentRole,
} from '../lib/rbac.js';
import { supabase } from '../lib/supabaseClient.js';

const SEV_MAP = { CRITICAL:'badge-critical', HIGH:'badge-high', MEDIUM:'badge-medium', LOW:'badge-low' };
const STATUS_MAP = { New:'status-open', Assigned:'status-in_progress', 'In Progress':'status-in_progress', Resolved:'status-resolved', Closed:'status-closed' };
const SLA_TARGETS = { CRITICAL:4, HIGH:8, MEDIUM:24, LOW:72 };
const SEVERITIES = ['CRITICAL','HIGH','MEDIUM','LOW'];

export default function IncidentDetailPage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [comments, setComments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [assignee, setAssignee] = useState('');
  const [escalationTarget, setEscalationTarget] = useState('');
  const [tab, setTab] = useState('comments');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const channelRef = useRef(null);

  const canAudit = hasCapability(currentUser?.role, 'audit.view');
  const canAssignAny = hasCapability(currentUser?.role, 'incidents.assign_any');
  const seniorIncidentRole = isSeniorIncidentRole(currentUser?.role);
  const allowedStatuses = allowedStatusesFor(currentUser?.role);

  const assignmentTargets = useMemo(
    () => assignmentTargetsFor(currentUser?.role, users),
    [currentUser?.role, users]
  );

  const escalationTargets = useMemo(
    () => assignmentTargetsFor('SOC_ANALYST_L2', users),
    [users]
  );

  const fmt = value => value
    ? new Date(value).toLocaleString('en-GB', {
        day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
      })
    : 'N/A';

  const getUserName = userId => {
    if (!userId) return 'Unassigned';
    return users.find(user => user.id === userId)?.name || 'Unknown';
  };

  const refreshAudit = async () => {
    if (!canAudit) return;
    const { data } = await supabase
      .from('audit_log')
      .select('*, actor:users(name)')
      .eq('incident_id', id)
      .order('created_at', { ascending: false });
    setAuditLogs(data || []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      const auditQuery = canAudit
        ? supabase.from('audit_log').select('*, actor:users(name)').eq('incident_id', id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const [incRes, cmtRes, logRes, usrRes] = await Promise.all([
        supabase.from('incidents').select('*').eq('id', id).single(),
        supabase.from('comments').select('*, author:users(name)').eq('incident_id', id).order('created_at', { ascending: true }),
        auditQuery,
        supabase.from('users').select('id, name, role_id, role:roles(id,name)').order('name'),
      ]);

      if (incRes.error) {
        setError('Incident not found or access denied.');
        setLoading(false);
        return;
      }

      setIncident(incRes.data);
      setStatus(incRes.data.status);
      setSeverity(incRes.data.severity);
      setAssignee(incRes.data.assigned_to || '');
      setComments(cmtRes.data || []);
      setAuditLogs(logRes.data || []);
      setUsers(usrRes.data || []);
      setLoading(false);
    };

    load();

    channelRef.current = supabase
      .channel(`incident-detail-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `incident_id=eq.${id}` },
        async payload => {
          const { data } = await supabase
            .from('comments')
            .select('*, author:users(name)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setComments(previous => [...previous.filter(comment => comment.id !== data.id), data]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${id}` },
        payload => {
          setIncident(previous => ({ ...previous, ...payload.new }));
          setStatus(payload.new.status);
          setSeverity(payload.new.severity);
          setAssignee(payload.new.assigned_to || '');
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [id, canAudit]);

  const updateIncident = async (changes, actionName) => {
    setSaving(actionName);
    setError('');

    const payload = { ...changes };
    if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
      payload.resolved_at = ['Resolved', 'Closed'].includes(changes.status)
        ? (incident.resolved_at || new Date().toISOString())
        : null;
    }

    const { data, error: updateError } = await supabase
      .from('incidents')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      setSaving('');
      return false;
    }

    setIncident(data);
    setStatus(data.status);
    setSeverity(data.severity);
    setAssignee(data.assigned_to || '');
    await refreshAudit();
    setSaving('');
    return true;
  };

  const handleStatusSave = () => {
    if (!allowedStatuses.includes(status)) {
      setError('That status transition is not available for your role.');
      return;
    }
    updateIncident({ status }, 'status');
  };

  const handleSeveritySave = () => {
    if (!seniorIncidentRole) return;
    updateIncident({ severity }, 'severity');
  };

  const handleAssignmentSave = () => {
    if (!canAssignAny) return;
    updateIncident(
      {
        assigned_to: assignee || null,
        status: assignee && incident.status === 'New' ? 'Assigned' : incident.status,
      },
      'assignment'
    );
  };

  const handleClaim = () => {
    if (!canClaimIncident(currentUser.role, incident)) return;
    updateIncident({ assigned_to: currentUser.id, status: 'Assigned' }, 'claim');
  };

  const handleEscalate = () => {
    if (!canEscalateIncident(currentUser.role, incident, currentUser.id) || !escalationTarget) return;
    updateIncident({ assigned_to: escalationTarget, status: 'Assigned' }, 'escalate');
  };

  const handleAddComment = async () => {
    const body = commentBody.trim();
    if (!body) return;

    setPosting(true);
    setError('');

    const { data, error: commentError } = await supabase
      .from('comments')
      .insert({ incident_id: id, user_id: currentUser.id, body })
      .select('*, author:users(name)')
      .single();

    if (commentError) {
      setError(commentError.message);
      setPosting(false);
      return;
    }

    setComments(previous => [...previous.filter(comment => comment.id !== data.id), data]);
    setCommentBody('');
    setPosting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <span className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !incident) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-lg">{error}</p>
          <Link to="/incidents" className="text-red-400 text-sm mt-2 inline-block hover:underline">
            Back to incidents
          </Link>
        </div>
      </div>
    );
  }

  const canEditStatus = canChangeStatus(currentUser.role, incident, currentUser.id);
  const canClaim = canClaimIncident(currentUser.role, incident);
  const canEscalate = canEscalateIncident(currentUser.role, incident, currentUser.id);

  const target = SLA_TARGETS[incident.severity] || 24;
  const elapsed = (Date.now() - new Date(incident.created_at)) / 3600000;
  const slaPct = Math.min((elapsed / target) * 100, 100);
  const slaColor = slaPct >= 100 ? 'bg-red-500' : slaPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
  const slaLabel = slaPct >= 100 ? 'SLA breached' : slaPct >= 75 ? 'SLA at risk' : 'Within SLA';

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center gap-1 mb-4 transition-colors"
          >
            <span aria-hidden="true">←</span>
            Back
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-600 font-mono mb-1">{String(incident.id || id).toUpperCase()}</p>
              <h1 className="text-xl font-semibold text-white">{incident.title}</h1>
              <p className="text-xs text-zinc-500 mt-2">
                {getUserName(incident.assigned_to)} · {incident.category?.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={SEV_MAP[incident.severity]}>{incident.severity}</span>
              <span className={STATUS_MAP[incident.status] || 'status-open'}>{incident.status}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/8 border border-red-500/25 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Description</h2>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{incident.description}</p>
            </section>

            <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-800">
                <button
                  type="button"
                  onClick={() => setTab('comments')}
                  className={`px-5 py-3 text-sm font-medium transition-colors ${tab === 'comments' ? 'text-red-300 border-b-2 border-red-500 bg-red-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Comments ({comments.length})
                </button>
                {canAudit && (
                  <button
                    type="button"
                    onClick={() => setTab('audit')}
                    className={`px-5 py-3 text-sm font-medium transition-colors ${tab === 'audit' ? 'text-red-300 border-b-2 border-red-500 bg-red-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Audit trail
                  </button>
                )}
              </div>

              {tab === 'comments' && (
                <div className="p-5 space-y-4">
                  {comments.length === 0 && (
                    <p className="text-zinc-600 text-sm text-center py-4">No comments yet.</p>
                  )}

                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/8 border border-red-500/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-red-300">
                          {(comment.author?.name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-zinc-200">{comment.author?.name || 'Unknown'}</span>
                          <span className="text-xs text-zinc-600">{fmt(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{comment.body}</p>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <input
                      value={commentBody}
                      onChange={event => setCommentBody(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleAddComment();
                        }
                      }}
                      placeholder="Add investigation note..."
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={posting || !commentBody.trim()}
                      className="btn-primary px-4"
                    >
                      {posting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'audit' && canAudit && (
                <div className="divide-y divide-gray-800">
                  {auditLogs.length === 0 && (
                    <p className="text-zinc-600 text-sm text-center py-8">No audit entries.</p>
                  )}
                  {auditLogs.map(log => (
                    <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                      <span className="text-xs font-mono text-zinc-600 shrink-0 mt-0.5 w-32">{fmt(log.created_at)}</span>
                      <div>
                        <span className="text-xs font-semibold text-red-300 uppercase">
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                        <p className="text-xs text-zinc-400 mt-0.5">{log.details}</p>
                        <p className="text-xs text-zinc-600">by {log.actor?.name || 'System'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            {(canEditStatus || canClaim || canEscalate || canAssignAny || seniorIncidentRole) && (
              <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Workflow actions</h2>

                {canClaim && (
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={Boolean(saving)}
                    className="btn-primary w-full"
                  >
                    {saving === 'claim' ? 'Claiming...' : 'Claim incident'}
                  </button>
                )}

                {canEditStatus && (
                  <div>
                    <label className="field-label">Status</label>
                    <select value={status} onChange={event => setStatus(event.target.value)} className="select">
                      {allowedStatuses.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={handleStatusSave}
                      disabled={Boolean(saving) || status === incident.status}
                      className="btn-secondary w-full mt-2"
                    >
                      {saving === 'status' ? 'Saving...' : 'Update status'}
                    </button>
                  </div>
                )}

                {seniorIncidentRole && (
                  <div>
                    <label className="field-label">Severity</label>
                    <select value={severity} onChange={event => setSeverity(event.target.value)} className="select">
                      {SEVERITIES.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={handleSeveritySave}
                      disabled={Boolean(saving) || severity === incident.severity}
                      className="btn-secondary w-full mt-2"
                    >
                      {saving === 'severity' ? 'Saving...' : 'Update severity'}
                    </button>
                  </div>
                )}

                {canAssignAny && (
                  <div>
                    <label className="field-label">Assignment</label>
                    <select value={assignee} onChange={event => setAssignee(event.target.value)} className="select">
                      <option value="">Unassigned</option>
                      {assignmentTargets.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} · {user.role?.name?.replace('SOC_', '').replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssignmentSave}
                      disabled={Boolean(saving) || assignee === (incident.assigned_to || '')}
                      className="btn-secondary w-full mt-2"
                    >
                      {saving === 'assignment' ? 'Saving...' : 'Update assignment'}
                    </button>
                  </div>
                )}

                {canEscalate && (
                  <div>
                    <label className="field-label">Escalate to L3 / Lead</label>
                    <select
                      value={escalationTarget}
                      onChange={event => setEscalationTarget(event.target.value)}
                      className="select"
                    >
                      <option value="">Choose escalation target...</option>
                      {escalationTargets.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} · {user.role?.name === 'SOC_LEAD' ? 'SOC Lead' : 'SOC Analyst L3'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleEscalate}
                      disabled={Boolean(saving) || !escalationTarget}
                      className="btn-secondary w-full mt-2"
                    >
                      {saving === 'escalate' ? 'Escalating...' : 'Escalate'}
                    </button>
                  </div>
                )}
              </section>
            )}

            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Details</h2>
              {[
                { label: 'Category', value: incident.category?.replace(/_/g, ' ') },
                { label: 'Affected asset', value: incident.affected_asset || 'N/A' },
                { label: 'Source IP', value: incident.source_ip || 'N/A' },
                { label: 'Created by', value: getUserName(incident.created_by) },
                { label: 'Assigned to', value: getUserName(incident.assigned_to) },
                { label: 'Created', value: fmt(incident.created_at) },
                { label: 'Last updated', value: fmt(incident.updated_at) },
                { label: 'Resolved at', value: incident.resolved_at ? fmt(incident.resolved_at) : '—' },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-zinc-600 mb-0.5">{row.label}</p>
                  <p className="text-sm text-zinc-300 font-medium">{row.value}</p>
                </div>
              ))}
            </section>

            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">SLA</h2>
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>{slaLabel}</span>
                <span>Target {target}h</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className={`h-2 rounded-full ${slaColor} transition-all`} style={{ width: `${slaPct}%` }} />
              </div>
              <p className="text-xs text-zinc-600 mt-1">{Math.round(elapsed)}h elapsed</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
