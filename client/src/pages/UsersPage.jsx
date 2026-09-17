import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLES = ['ADMIN','SOC_LEAD','SOC_ANALYST'];

export default function UsersPage() {
  const { currentUser } = useAuth();
  const [users,     setUsers]     = useState([]);
  const [roles,     setRoles]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState({ name:'', email:'', password:'', role_id:'' });
  const [saving,    setSaving]    = useState(false);

  const load = async () => {
    setLoading(true);
    const [uRes, rRes] = await Promise.all([
      supabase.from('users').select('*, role:roles(id,name)').order('created_at',{ascending:false}),
      supabase.from('roles').select('*'),
    ]);
    if (uRes.error) setError(uRes.error.message);
    else setUsers(uRes.data||[]);
    setRoles(rRes.data||[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handle = e => setForm(f => ({...f, [e.target.name]: e.target.value}));

  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    // 1. Create auth user via admin API is not available client-side;
    //    instead use supabase.auth.signUp then update public.users
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options:  { data: { name: form.name } },
    });
    if (authErr) { setError(authErr.message); setSaving(false); return; }
    // 2. Update public.users row created by trigger
    const { error: updErr } = await supabase.from('users')
      .update({ name: form.name, role_id: form.role_id || null })
      .eq('id', authData.user.id);
    if (updErr) { setError(updErr.message); setSaving(false); return; }
    setShowForm(false);
    setForm({ name:'', email:'', password:'', role_id:'' });
    await load();
    setSaving(false);
  };

  const handleRoleChange = async (userId, roleId) => {
    const { error } = await supabase.from('users').update({ role_id: roleId }).eq('id', userId);
    if (error) { setError(error.message); return; }
    setUsers(prev => prev.map(u => u.id === userId
      ? { ...u, role_id: roleId, role: roles.find(r => r.id === roleId) }
      : u
    ));
  };

  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : 'N/A';
  const filtered = users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
  const ROLE_COLORS = { ADMIN:'text-red-400', SOC_LEAD:'text-orange-400', SOC_ANALYST:'text-blue-400' };

  return (
    <div className="min-h-screen bg-gray-950 p-6 fade-in">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">User <span className="text-blue-400">Management</span></h1>
            <p className="text-gray-500 text-sm mt-0.5">{users.length} registered users</p>
          </div>
          <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add User
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Full Name</label>
              <input name="name" value={form.name} onChange={handle} required placeholder="Jane Smith" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={handle} required placeholder="jane@ccorp.local" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
              <input name="password" type="password" value={form.password} onChange={handle} required minLength={8} placeholder="Min 8 chars" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
              <select name="role_id" value={form.role_id} onChange={handle} required className="select w-full">
                <option value="">Select role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</> : 'Create User'}
              </button>
              <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email..." className="input pl-9 w-full" />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Joined</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-600 text-sm"><span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Loading...</span></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-600 text-sm">No users found.</td></tr>}
              {!loading && filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-400">{u.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-100">{u.name}</p>
                        {u.id === currentUser.id && <span className="text-xs text-blue-400">(you)</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs font-mono">{u.email}</td>
                  <td className="px-5 py-4">
                    <select
                      value={u.role_id||''}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === currentUser.id}
                      className={`text-xs px-2 py-1 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500 ${ROLE_COLORS[u.role?.name]||'text-gray-400'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-gray-500 text-xs font-mono">{fmt(u.created_at)}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-green-400">&bull; Active</span>
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
