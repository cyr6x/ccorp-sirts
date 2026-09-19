import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS } from '../lib/rbac.js';
import { supabase } from '../lib/supabaseClient.js';

const INITIAL_FORM = { name:'', email:'', password:'', role_id:'' };
const STAFF_EMAIL_PATTERN = /^[A-Z0-9._%+-]+@ccorp\.local$/i;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export default function UsersPage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');

    const [userResult, roleResult] = await Promise.all([
      supabase.from('users').select('*, role:roles(id,name)').order('name'),
      supabase.from('roles').select('id,name,permissions').order('name'),
    ]);

    if (userResult.error) setError(userResult.error.message);
    else setUsers(userResult.data || []);

    if (roleResult.error) setError(roleResult.error.message);
    else setRoles(roleResult.data || []);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(user =>
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role_id?.toLowerCase().includes(query)
    );
  }, [users, search]);

  const handle = event => {
    setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleCreate = async event => {
    event.preventDefault();
    setError('');
    setNotice('');

    const email = form.email.trim().toLowerCase();
    if (!STAFF_EMAIL_PATTERN.test(email)) {
      setError('Use a valid CCorp staff email ending in @ccorp.local.');
      return;
    }

    if (!STRONG_PASSWORD_PATTERN.test(form.password)) {
      setError('Temporary password must be at least 12 characters and include upper, lower, number, and symbol.');
      return;
    }

    setSaving(true);

    const { data, error: functionError } = await supabase.functions.invoke('admin-create-user', {
      body: {
        name: form.name.trim(),
        email,
        password: form.password,
        role_id: form.role_id,
      },
    });

    if (functionError || data?.error) {
      setError(data?.error || functionError?.message || 'Unable to create user.');
      setSaving(false);
      return;
    }

    setForm(INITIAL_FORM);
    setShowForm(false);
    setNotice(`${data.user.name} was created successfully.`);
    await load();
    setSaving(false);
  };

  const handleRoleChange = async (userId, roleId) => {
    setError('');
    setNotice('');

    const { error: updateError } = await supabase
      .from('users')
      .update({ role_id: roleId })
      .eq('id', userId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setUsers(previous => previous.map(user =>
      user.id === userId
        ? { ...user, role_id: roleId, role: roles.find(role => role.id === roleId) }
        : user
    ));
    setNotice('Role updated.');
  };

  const fmt = value => value
    ? new Date(value).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : 'N/A';

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-red-400 mb-2">Administration</p>
            <h1 className="text-2xl font-semibold text-white">Staff access</h1>
            <p className="text-zinc-500 text-sm mt-1">{users.length} active staff profiles</p>
          </div>
          <button type="button" onClick={() => setShowForm(value => !value)} className="btn-primary">
            {showForm ? 'Close form' : 'Add staff user'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/25 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-200 text-sm">
            {notice}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="staff-name" className="field-label">Full name</label>
              <input id="staff-name" name="name" value={form.name} onChange={handle} required minLength={2} className="input" />
            </div>
            <div>
              <label htmlFor="staff-email" className="field-label">Email</label>
              <input id="staff-email" name="email" type="email" value={form.email} onChange={handle} required className="input" />
            </div>
            <div>
              <label htmlFor="staff-password" className="field-label">Temporary password</label>
              <input
                id="staff-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handle}
                required
                minLength={12}
                pattern=".{12,}"
                title="Use at least 12 characters with upper, lower, number, and symbol"
                autoComplete="new-password"
                placeholder="Minimum 12 characters"
                className="input"
              />
              <p className="text-[11px] text-zinc-600 mt-1">Minimum 12 characters with upper, lower, number, and symbol. Rotate after first use.</p>
            </div>
            <div>
              <label htmlFor="staff-role" className="field-label">Role</label>
              <select id="staff-role" name="role_id" value={form.role_id} onChange={handle} required className="select">
                <option value="">Select role...</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{ROLE_LABELS[role.name] ?? role.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Creating...' : 'Create staff user'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search staff by name, email, or role..."
            className="input"
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Joined</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-600">Loading staff...</td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-600">No staff users found.</td>
                </tr>
              )}

              {!loading && filtered.map(user => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/15 flex items-center justify-center">
                        <span className="text-xs font-semibold text-red-300">{user.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-zinc-100">{user.name}</p>
                        {user.id === currentUser.id && <span className="text-[11px] text-red-300">Current session</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-zinc-400 text-xs font-mono">{user.email}</td>
                  <td className="px-5 py-4">
                    <select
                      value={user.role_id || ''}
                      onChange={event => handleRoleChange(user.id, event.target.value)}
                      disabled={user.id === currentUser.id}
                      className="text-xs px-2 py-1.5 rounded bg-zinc-900 border border-white/[0.08] text-zinc-300 focus:outline-none focus:border-red-500 disabled:opacity-50"
                    >
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{ROLE_LABELS[role.name] ?? role.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-zinc-500 text-xs font-mono">{fmt(user.created_at)}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-emerald-400">● Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
