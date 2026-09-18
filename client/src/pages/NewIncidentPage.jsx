import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { assignmentTargetsFor, hasCapability } from '../lib/rbac.js';
import { supabase } from '../lib/supabaseClient.js';

const CATEGORIES = ['PHISHING','MALWARE','UNAUTHORISED_ACCESS','DOS','OTHER'];
const SEVERITIES = ['CRITICAL','HIGH','MEDIUM','LOW'];

export default function NewIncidentPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title:'',
    description:'',
    category:'PHISHING',
    severity:'MEDIUM',
    source_ip:'',
    affected_asset:'',
    assigned_to:'',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canAssign = hasCapability(currentUser.role, 'incidents.assign_any');
  const assignmentTargets = useMemo(
    () => assignmentTargetsFor(currentUser.role, users),
    [currentUser.role, users]
  );

  useEffect(() => {
    if (!canAssign) return;
    supabase
      .from('users')
      .select('id, name, role_id, role:roles(id,name)')
      .order('name')
      .then(({ data }) => setUsers(data || []));
  }, [canAssign]);

  const handle = event => {
    setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('incidents')
      .insert({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        severity: form.severity,
        source_ip: form.source_ip.trim() || null,
        affected_asset: form.affected_asset.trim() || null,
        status: form.assigned_to ? 'Assigned' : 'New',
        created_by: currentUser.id,
        assigned_to: canAssign && form.assigned_to ? form.assigned_to : null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    navigate(`/incidents/${data.id}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-zinc-500 hover:text-zinc-300 text-sm mb-3 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-semibold text-white">Create incident</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Capture the initial evidence. SIRTS records the creation event automatically.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/8 border border-red-500/25 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <div>
            <label htmlFor="title" className="field-label">Title</label>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handle}
              required
              minLength={4}
              maxLength={160}
              placeholder="Brief incident title"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="description" className="field-label">Description</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handle}
              required
              minLength={10}
              maxLength={5000}
              rows={6}
              placeholder="What happened, how it was detected, and what is currently known..."
              className="input resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="field-label">Category</label>
              <select id="category" name="category" value={form.category} onChange={handle} className="select">
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="severity" className="field-label">Severity</label>
              <select id="severity" name="severity" value={form.severity} onChange={handle} className="select">
                {SEVERITIES.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="source_ip" className="field-label">Source IP</label>
              <input
                id="source_ip"
                name="source_ip"
                value={form.source_ip}
                onChange={handle}
                maxLength={64}
                placeholder="192.168.1.1"
                className="input font-mono"
              />
            </div>
            <div>
              <label htmlFor="affected_asset" className="field-label">Affected asset</label>
              <input
                id="affected_asset"
                name="affected_asset"
                value={form.affected_asset}
                onChange={handle}
                maxLength={120}
                placeholder="WEB-PROD-01"
                className="input font-mono"
              />
            </div>
          </div>

          {canAssign && (
            <div>
              <label htmlFor="assigned_to" className="field-label">Initial assignment</label>
              <select id="assigned_to" name="assigned_to" value={form.assigned_to} onChange={handle} className="select">
                <option value="">Leave in triage queue</option>
                {assignmentTargets.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.role?.name?.replace('SOC_', '').replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Creating...' : 'Create incident'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
