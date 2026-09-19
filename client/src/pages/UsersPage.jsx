import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS } from '../lib/rbac.js';
import { formatPersonName, initialsFor } from '../lib/userDisplay.js';

export default function UsersPage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const [uRes, rRes] = await Promise.all([
      supabase.from('users').select('*, role:roles(id,name)').order('name'),
      supabase.from('roles').select('id,name').order('name'),
    ]);
    if (uRes.error) setError(uRes.error.message);
    else setUsers(uRes.data || []);
    if (rRes.error) setError(rRes.error.message);
    else setRoles(rRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(user =>
      user.name?.toLowerCase().includes(needle) ||
      user.email?.toLowerCase().includes(needle) ||
      user.role_id?.toLowerCase().includes(needle)
    );
  }, [search, users]);

  const changeRole = async (userId, roleId) => {
    setError('');
    setNotice('');
    const { error: updateError } = await supabase.from('users').update({ role_id: roleId }).eq('id', userId);
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

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-red-400 mb-2">Administration</p>
          <h1 className="text-2xl font-semibold text-white">Staff access</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Role management only in this development milestone. Account onboarding will be added later.
          </p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg border border-red-500/25 bg-red-500/8 text-red-200 text-sm">{error}</div>}
        {notice && <div className="mb-4 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 text-emerald-200 text-sm">{notice}</div>}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search staff by name, email, or role..."
            className="input w-full"
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Staff</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && <tr><td colSpan={4} className="px-5 py-10 text-center text-zinc-600">Loading staff...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-zinc-600">No staff found.</td></tr>}
              {!loading && filtered.map(user => (
                <tr key={user.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/8 border border-red-500/15 flex items-center justify-center text-xs text-red-300">
                        {initialsFor(user.name)}
                      </div>
                      <div>
                        <p className="text-zinc-100 font-medium">{formatPersonName(user.name)}</p>
                        {user.id === currentUser.id && <p className="text-[11px] text-red-300 mt-0.5">Current session</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-zinc-400">{user.email}</td>
                  <td className="px-5 py-4">
                    <select
                      value={user.role_id}
                      onChange={event => changeRole(user.id, event.target.value)}
                      disabled={user.id === currentUser.id}
                      className="select max-w-[220px]"
                    >
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{ROLE_LABELS[role.name] ?? role.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-xs text-emerald-400">● Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
