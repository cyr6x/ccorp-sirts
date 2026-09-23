import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const initial = { incident_id:'', personal_data_involved:'', unauthorised_access_or_acquisition:'', real_risk_of_harm:'', awareness_at:'', outcome:'PENDING_REVIEW', assessment_reason:'', breach_circumstances:'', data_and_people_affected:'', likely_consequences:'', mitigation_measures:'', responsible_role:'SOC_LEAD', contact_point:'' };
const yesNo = [['personal_data_involved','Personal data involved'],['unauthorised_access_or_acquisition','Unauthorised access / acquisition'],['real_risk_of_harm','Real risk of harm']];
const narratives = [['assessment_reason','Assessment reason'],['breach_circumstances','Breach circumstances'],['data_and_people_affected','Data and people affected'],['likely_consequences','Likely consequences / harm'],['mitigation_measures','Mitigation / remedial measures']];
const date = value => value ? new Date(value).toLocaleString('en-GB') : 'Not recorded';
const remaining = record => {
  if (!record.deadline_at) return 'Not applicable';
  if (record.notification_state !== 'PENDING') return record.notification_state;
  const hours = Math.ceil((new Date(record.deadline_at).getTime() - Date.now()) / 3600000);
  return hours < 0 ? `${Math.abs(hours)}h overdue` : `${hours}h remaining`;
};

export default function KdpaTrackerPage() {
  const [params] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const [assessments, incidentList] = await Promise.all([
      supabase.from('breach_assessments').select('*, incident:incidents(id,title)').order('updated_at', { ascending:false }),
      supabase.from('incidents').select('id,title').order('created_at', { ascending:false }),
    ]);
    if (assessments.error || incidentList.error) {
      setRecords([]); setIncidents([]);
      setError('The tracker could not load. Confirm that the C3 database migration is installed, then retry.');
    } else {
      setRecords(assessments.data || []); setIncidents(incidentList.data || []); setError('');
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const change = event => setForm(current => ({ ...current, [event.target.name]:event.target.value }));
  const begin = record => {
    setError('');
    const selected = record || records.find(item => item.incident_id === params.get('incident'));
    setEditingExisting(Boolean(selected));
    setForm(selected ? Object.fromEntries(Object.keys(initial).map(key => [key,
      key === 'awareness_at' && selected[key] ? new Date(selected[key]).toISOString().slice(0,16)
        : typeof selected[key] === 'boolean' ? String(selected[key]) : selected[key] ?? initial[key]
    ])) : { ...initial, incident_id:params.get('incident') || '' });
    setEditing(true);
  };
  const save = async event => {
    event.preventDefault(); setSaving(true); setError('');
    const payload = { ...form, awareness_at:form.awareness_at ? new Date(form.awareness_at).toISOString() : null };
    for (const [key] of yesNo) payload[key] = form[key] === '' ? null : form[key] === 'true';
    const exists = records.some(record => record.incident_id === form.incident_id);
    const result = exists
      ? await supabase.from('breach_assessments').update(payload).eq('incident_id', form.incident_id)
      : await supabase.from('breach_assessments').insert(payload);
    if (result.error) setError('Could not save. Check the qualifying answers, awareness time, reason and your role.');
    else { setEditing(false); await load(); }
    setSaving(false);
  };
  const markSent = async record => {
    if (!window.confirm('Confirm that an external notification was actually sent? SIRTS does not send it.')) return;
    setSaving(true);
    const { error:updateError } = await supabase.from('breach_assessments').update({ notification_state:'SENT' }).eq('incident_id',record.incident_id);
    if (updateError) setError('Could not record the notification. Please retry.');
    else await load();
    setSaving(false);
  };

  return <main className="min-h-screen bg-gray-950 p-4 sm:p-6 fade-in"><div className="max-w-screen-xl mx-auto">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6"><div>
      <h1 className="text-2xl font-bold text-white">Breach <span className="text-red-400">Assessment &amp; KDPA Tracker</span></h1>
      <p className="text-gray-400 text-sm mt-2 max-w-3xl">Internal human assessment and 72-hour tracking aid. SIRTS does not determine legal compliance or send external notifications. Operational SLA is separate.</p>
    </div>{!editing && <button type="button" onClick={() => begin(null)} className="btn-primary">Assess incident</button>}</div>
    {error && <p role="alert" className="p-3 mb-5 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>}
    {editing && <form onSubmit={save} className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6 mb-6 space-y-4">
      <h2 className="font-semibold text-white">Human breach assessment</h2><div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm text-gray-300">Incident<select name="incident_id" value={form.incident_id} onChange={change} required disabled={editingExisting} className="select w-full mt-1"><option value="">Select an incident</option>{incidents.filter(item => editingExisting ? item.id === form.incident_id : !records.some(record => record.incident_id === item.id)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="text-sm text-gray-300">Awareness time (local time)<input type="datetime-local" name="awareness_at" value={form.awareness_at} onChange={change} className="input w-full mt-1" /></label>
        {yesNo.map(([key,label]) => <label key={key} className="text-sm text-gray-300">{label}<select name={key} value={form[key]} onChange={change} className="select w-full mt-1"><option value="">Not assessed</option><option value="true">Yes</option><option value="false">No</option></select></label>)}
        <label className="text-sm text-gray-300">Assessment outcome<select name="outcome" value={form.outcome} onChange={change} className="select w-full mt-1"><option value="PENDING_REVIEW">Pending review</option><option value="NOTIFICATION_REQUIRED">Notification required</option><option value="NOTIFICATION_NOT_REQUIRED">Notification not required</option></select></label>
        <label className="text-sm text-gray-300">Responsible role<select name="responsible_role" value={form.responsible_role} onChange={change} className="select w-full mt-1"><option value="SOC_LEAD">SOC Lead</option><option value="ADMIN">Admin</option></select></label>
        <label className="text-sm text-gray-300">Contact point<input name="contact_point" value={form.contact_point} onChange={change} className="input w-full mt-1" /></label>
      </div>
      {narratives.map(([key,label]) => <label key={key} className="block text-sm text-gray-300">{label}<textarea name={key} value={form[key]} onChange={change} rows={2} className="input w-full mt-1" /></label>)}
      <p className="text-xs text-gray-400">A 72-hour deadline requires all three answers Yes, an awareness time and a reason. The timestamp is not incident creation time.</p>
      <div className="flex gap-3"><button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save assessment'}</button><button type="button" onClick={() => setEditing(false)} className="text-gray-300 underline">Cancel</button></div>
    </form>}
    {loading ? <p role="status" className="text-gray-400 py-10">Loading assessments…</p> : !error && records.length === 0 ? <p className="text-gray-400 bg-gray-900 border border-gray-800 rounded-xl p-8">No incidents have been assessed yet.</p> : <div className="grid gap-4">{records.map(record => <article key={record.incident_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><Link to={`/incidents/${record.incident_id}`} className="text-red-400 hover:underline font-semibold">{record.incident?.title || record.incident_id}</Link><p className="text-sm text-gray-300 mt-1">{record.outcome.replaceAll('_',' ')} · {record.notification_state || 'No notification deadline'}</p></div>
        <div className="flex gap-3"><button type="button" onClick={() => begin(record)} className="text-sm text-gray-200 underline">Review / edit</button>{record.notification_state === 'PENDING' && <button type="button" disabled={saving} onClick={() => markSent(record)} className="text-sm text-red-400 underline">Record as sent</button>}</div></div>
      <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 text-xs text-gray-400">{[['Awareness / trigger',date(record.awareness_at)],['72-hour deadline',date(record.deadline_at)],['Remaining / overdue',remaining(record)],['Notification recorded',date(record.notified_at)],['Responsible role',record.responsible_role.replace('_',' ')],['Contact point',record.contact_point || 'Not recorded']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd className="text-gray-200">{value}</dd></div>)}</dl>
    </article>)}</div>}
  </div></main>;
}
