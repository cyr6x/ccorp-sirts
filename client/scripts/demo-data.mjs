export const DEMO_PROJECT_REF = 'cudagansojpjtligqewe';
export const DEMO_EMAIL_DOMAIN = 'demo.ccorp.example';

export const DEMO_USERS = [
  { key: 'lead',  first_name: 'Grace',  last_name: 'N.', email: `grace.n@${DEMO_EMAIL_DOMAIN}`,  role_id: 'SOC_LEAD' },
  { key: 'l1a',   first_name: 'Amina',  last_name: 'K.', email: `amina.k@${DEMO_EMAIL_DOMAIN}`,  role_id: 'SOC_ANALYST_L1' },
  { key: 'l1b',   first_name: 'Joel',   last_name: 'M.', email: `joel.m@${DEMO_EMAIL_DOMAIN}`,   role_id: 'SOC_ANALYST_L1' },
  { key: 'l2a',   first_name: 'Mariam', last_name: 'T.', email: `mariam.t@${DEMO_EMAIL_DOMAIN}`, role_id: 'SOC_ANALYST_L2' },
  { key: 'l2b',   first_name: 'Peter',  last_name: 'O.', email: `peter.o@${DEMO_EMAIL_DOMAIN}`,  role_id: 'SOC_ANALYST_L2' },
  { key: 'l3',    first_name: 'Lydia',  last_name: 'A.', email: `lydia.a@${DEMO_EMAIL_DOMAIN}`,  role_id: 'SOC_ANALYST_L3' },
];

const uuid = (series, number) => `${series}0000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const iso = value => new Date(value).toISOString();

export function buildDemoData(actorIds, referenceDate = new Date()) {
  for (const user of DEMO_USERS) {
    if (!actorIds[user.key]) throw new Error(`Missing demo actor ID for ${user.key}.`);
  }

  const now = new Date(referenceDate);
  if (Number.isNaN(now.getTime())) throw new Error('A valid reference date is required.');
  const ago = hours => iso(now.getTime() - hours * 60 * 60 * 1000);
  const after = (timestamp, hours) => iso(new Date(timestamp).getTime() + hours * 60 * 60 * 1000);

  const assets = [
    { id: uuid('1',1), name:'DEMO-FW-KLA-01', type:'NETWORK_DEVICE', ip_address:'10.20.0.1', os:'FortiOS 7.4', owner:'IT Infrastructure', risk_level:'CRITICAL', status:'ACTIVE', notes:'Fictional Kampala perimeter firewall used for SIRTS demonstrations.' },
    { id: uuid('1',2), name:'DEMO-AD-01', type:'SERVER', ip_address:'10.20.1.10', os:'Windows Server 2022', owner:'IT Infrastructure', risk_level:'CRITICAL', status:'ACTIVE', notes:'Fictional primary identity server.' },
    { id: uuid('1',3), name:'DEMO-FIN-FS-01', type:'SERVER', ip_address:'10.20.2.20', os:'Windows Server 2022', owner:'Finance', risk_level:'HIGH', status:'ACTIVE', notes:'Fictional finance file service.' },
    { id: uuid('1',4), name:'DEMO-HR-APP-01', type:'APPLICATION', ip_address:'10.20.3.15', os:'Ubuntu 24.04 LTS', owner:'Human Resources', risk_level:'HIGH', status:'ACTIVE', notes:'Fictional employee self-service application.' },
    { id: uuid('1',5), name:'DEMO-CRM-DB-01', type:'DATABASE', ip_address:'10.20.4.12', os:'PostgreSQL 17', owner:'Customer Operations', risk_level:'CRITICAL', status:'ACTIVE', notes:'Fictional customer-service database.' },
    { id: uuid('1',6), name:'DEMO-VPN-01', type:'NETWORK_DEVICE', ip_address:'10.20.0.5', os:'PAN-OS 11', owner:'IT Infrastructure', risk_level:'HIGH', status:'ACTIVE', notes:'Fictional remote-access gateway.' },
    { id: uuid('1',7), name:'DEMO-MAIL-01', type:'APPLICATION', ip_address:null, os:'Microsoft 365', owner:'Corporate Services', risk_level:'HIGH', status:'ACTIVE', notes:'Fictional cloud-mail tenant record; no public address is stored.' },
    { id: uuid('1',8), name:'DEMO-WKS-FIN-14', type:'WORKSTATION', ip_address:'10.20.12.44', os:'Windows 11 Enterprise', owner:'Finance', risk_level:'MEDIUM', status:'ACTIVE', notes:'Fictional finance workstation.' },
    { id: uuid('1',9), name:'DEMO-WEB-PORTAL-01', type:'APPLICATION', ip_address:'10.20.5.30', os:'Ubuntu 24.04 LTS', owner:'Digital Services', risk_level:'HIGH', status:'MAINTENANCE', notes:'Fictional public-service portal currently under maintenance.' },
    { id: uuid('1',10), name:'DEMO-BACKUP-01', type:'SERVER', ip_address:'10.20.6.18', os:'Rocky Linux 9', owner:'IT Infrastructure', risk_level:'MEDIUM', status:'ACTIVE', notes:'Fictional backup orchestration server.' },
  ];

  const incidentSpecs = [
    { id:uuid('2',1), code:'SIM-2609-001', title:'Suspicious payroll mailbox sign-in', category:'UNAUTHORISED_ACCESS', severity:'CRITICAL', status:'In Progress', source_ip:'203.0.113.41', asset:7, creator:'l1a', assignee:'l2a', age:6, description:'Fictional simulation: impossible-travel alert followed by repeated MFA prompts on the payroll mailbox.' },
    { id:uuid('2',2), code:'SIM-2609-002', title:'Malware quarantined on finance share', category:'MALWARE', severity:'HIGH', status:'Resolved', source_ip:'198.51.100.27', asset:3, creator:'l1b', assignee:'l3', age:48, resolvedAfter:6, description:'Fictional simulation: endpoint telemetry identified and quarantined a malicious archive opened from a finance share.' },
    { id:uuid('2',3), code:'SIM-2609-003', title:'Unauthorised VPN session after off-hours login', category:'UNAUTHORISED_ACCESS', severity:'MEDIUM', status:'Closed', source_ip:'192.0.2.86', asset:6, creator:'l1a', assignee:'l2b', age:96, resolvedAfter:18, description:'Fictional simulation: an off-hours VPN session was validated, contained and reviewed with the account owner.' },
    { id:uuid('2',4), code:'SIM-2609-004', title:'Public portal traffic saturation', category:'DOS', severity:'MEDIUM', status:'Assigned', source_ip:'198.51.100.92', asset:9, creator:'lead', assignee:'l1b', age:144, description:'Fictional simulation: sustained request bursts degraded the demonstration public portal.' },
    { id:uuid('2',5), code:'SIM-2609-005', title:'Unexpected mailbox forwarding rule', category:'PHISHING', severity:'HIGH', status:'In Progress', source_ip:'203.0.113.109', asset:7, creator:'l1a', assignee:'l1a', age:264, description:'Fictional simulation: a newly created external forwarding rule requires containment and mailbox review.' },
    { id:uuid('2',6), code:'SIM-2609-006', title:'CRM database service account lockouts', category:'UNAUTHORISED_ACCESS', severity:'CRITICAL', status:'Resolved', source_ip:'192.0.2.54', asset:5, creator:'l2a', assignee:'l2a', age:432, resolvedAfter:3, description:'Fictional simulation: repeated service-account failures were traced to an expired application credential.' },
    { id:uuid('2',7), code:'SIM-2609-007', title:'Browser adware detected on finance workstation', category:'MALWARE', severity:'LOW', status:'Resolved', source_ip:'198.51.100.18', asset:8, creator:'l1b', assignee:'l1b', age:648, resolvedAfter:20, description:'Fictional simulation: unwanted browser extensions were removed and the endpoint passed a clean scan.' },
    { id:uuid('2',8), code:'SIM-2608-008', title:'Leaver account retained application access', category:'UNAUTHORISED_ACCESS', severity:'MEDIUM', status:'Closed', source_ip:null, asset:4, creator:'lead', assignee:'l2b', age:840, resolvedAfter:30, description:'Fictional simulation: a delayed deprovisioning check found residual HR application access.' },
    { id:uuid('2',9), code:'SIM-2609-009', title:'External DNS anomaly under review', category:'OTHER', severity:'CRITICAL', status:'New', source_ip:'203.0.113.200', asset:1, creator:'lead', assignee:null, age:1, description:'Fictional simulation: monitoring detected an unusual DNS response pattern at the perimeter.' },
    { id:uuid('2',10), code:'SIM-2608-010', title:'Backup job alert confirmed as false positive', category:'OTHER', severity:'LOW', status:'Closed', source_ip:null, asset:10, creator:'l3', assignee:'l3', age:1176, resolvedAfter:4, description:'Fictional simulation: a delayed heartbeat generated an alert while the backup completed successfully.' },
    { id:uuid('2',11), code:'SIM-2607-011', title:'Malicious attachment blocked in shared inbox', category:'PHISHING', severity:'HIGH', status:'Resolved', source_ip:'192.0.2.118', asset:7, creator:'l1a', assignee:'l3', age:1536, resolvedAfter:5, description:'Fictional simulation: mail controls blocked a credential-harvesting attachment before delivery.' },
    { id:uuid('2',12), code:'SIM-2606-012', title:'Repeated network scan from guest segment', category:'OTHER', severity:'MEDIUM', status:'In Progress', source_ip:'198.51.100.145', asset:1, creator:'l2b', assignee:'l2b', age:1992, description:'Fictional simulation: internal monitoring observed repeated connection attempts from an isolated guest segment.' },
  ];

  const incidents = incidentSpecs.map(item => {
    const created_at = ago(item.age);
    return {
      id:item.id,
      title:`${item.code} — ${item.title}`,
      description:item.description,
      category:item.category,
      severity:item.severity,
      status:item.status,
      source_ip:item.source_ip,
      affected_asset:assets[item.asset - 1].name,
      created_by:actorIds[item.creator],
      assigned_to:item.assignee ? actorIds[item.assignee] : null,
      resolved_at:item.resolvedAfter ? after(created_at,item.resolvedAfter) : null,
      created_at,
      updated_at:item.resolvedAfter ? after(created_at,item.resolvedAfter) : created_at,
    };
  });

  const incident_assets = incidentSpecs.map((item, index) => ({
    incident_id:item.id,
    asset_id:assets[item.asset - 1].id,
    added_by:actorIds[item.assignee || item.creator],
    created_at:after(incidents[index].created_at,0.25),
  }));

  const commentSpecs = [
    [1,'l1a','Mailbox owner contacted; session tokens have been revoked.'],
    [1,'l2a','Reviewing sign-in telemetry and MFA registration changes.'],
    [2,'l3','Endpoint isolated, archive removed and hashes blocked.'],
    [3,'l2b','VPN session terminated; no follow-on activity identified.'],
    [4,'l1b','Traffic sample captured and rate-limit review assigned.'],
    [5,'l1a','Forwarding rule disabled; mailbox search is in progress.'],
    [6,'l2a','Service credential rotated and dependent jobs recovered.'],
    [7,'l1b','Extension removed and clean scan evidence attached to the case notes.'],
    [9,'lead','Triage requested; validate resolver health before escalation.'],
    [12,'l2b','Guest segment remains isolated while the device is identified.'],
  ];
  const comments = commentSpecs.map(([incidentNumber,userKey,body],index) => ({
    id:uuid('3',index + 1),
    incident_id:uuid('2',incidentNumber),
    user_id:actorIds[userKey],
    body,
    created_at:after(incidents[incidentNumber - 1].created_at,Math.min(2,index / 3 + 0.5)),
  }));

  const incident_updates = [];
  let updateNumber = 1;
  for (const incident of incidents) {
    if (incident.assigned_to) {
      incident_updates.push({ id:uuid('4',updateNumber++), incident_id:incident.id, changed_by:incident.created_by, field_changed:'assigned_to', old_value:null, new_value:incident.assigned_to, created_at:after(incident.created_at,0.2) });
    }
    if (incident.status !== 'New' && incident.status !== 'Assigned') {
      incident_updates.push({ id:uuid('4',updateNumber++), incident_id:incident.id, changed_by:incident.assigned_to, field_changed:'status', old_value:incident.assigned_to ? 'Assigned' : 'New', new_value:incident.status, created_at:incident.resolved_at || after(incident.created_at,1) });
    }
  }

  const audit_log = [];
  let auditNumber = 1;
  for (const incident of incidents) {
    audit_log.push({ id:uuid('5',auditNumber++), incident_id:incident.id, user_id:incident.created_by, action:'INCIDENT_CREATED', details:JSON.stringify({ title:incident.title, severity:incident.severity, status:'New', demo:true }), created_at:incident.created_at });
    if (incident.assigned_to) {
      audit_log.push({ id:uuid('5',auditNumber++), incident_id:incident.id, user_id:incident.created_by, action:'ASSIGNED', details:JSON.stringify({ title:incident.title, assigned_to:incident.assigned_to, demo:true }), created_at:after(incident.created_at,0.2) });
    }
    if (!['New','Assigned'].includes(incident.status)) {
      const action = incident.status === 'Resolved' ? 'RESOLVED' : incident.status === 'Closed' ? 'CLOSED' : 'STATUS_CHANGED';
      audit_log.push({ id:uuid('5',auditNumber++), incident_id:incident.id, user_id:incident.assigned_to, action, details:JSON.stringify({ title:incident.title, status:incident.status, demo:true }), created_at:incident.resolved_at || after(incident.created_at,1) });
    }
  }
  for (const comment of comments) {
    audit_log.push({ id:uuid('5',auditNumber++), incident_id:comment.incident_id, user_id:comment.user_id, action:'COMMENT_ADDED', details:JSON.stringify({ comment_id:comment.id, body_length:comment.body.length, demo:true }), created_at:comment.created_at });
  }

  const kb_articles = [
    { id:uuid('6',1), title:'Mailbox compromise triage checklist', summary:'First-response sequence for suspicious sign-ins, MFA fatigue and forwarding rules.', content:'## Triage\n1. Revoke active sessions.\n2. Review sign-in and MFA events.\n3. Remove unauthorised rules.\n4. Reset credentials through the approved process.\n5. Record containment evidence in SIRTS.', category:'UNAUTHORISED_ACCESS', author_id:actorIds.lead, tags:['mailbox','identity','containment'], source_incident_id:incidents[0].id, created_at:after(incidents[0].created_at,2), updated_at:after(incidents[0].created_at,2) },
    { id:uuid('6',2), title:'Endpoint malware containment runbook', summary:'Isolation, evidence preservation, eradication and return-to-service steps.', content:'## Containment\n- Isolate the endpoint.\n- Preserve alert identifiers and hashes.\n- Block confirmed indicators.\n- Run approved scans.\n- Reconnect only after validation.', category:'MALWARE', author_id:actorIds.l3, tags:['endpoint','malware','eradication'], source_incident_id:incidents[1].id, created_at:after(incidents[1].created_at,8), updated_at:after(incidents[1].created_at,8) },
    { id:uuid('6',3), title:'VPN access investigation guide', summary:'Evidence to collect when a remote-access session appears unauthorised.', content:'## Evidence\nCapture identity, device, source range, session duration, MFA outcome and downstream activity. Terminate suspect sessions before credential recovery.', category:'UNAUTHORISED_ACCESS', author_id:actorIds.l2b, tags:['vpn','remote-access','identity'], source_incident_id:incidents[2].id, created_at:after(incidents[2].created_at,22), updated_at:after(incidents[2].created_at,22) },
    { id:uuid('6',4), title:'Phishing message reporting standard', summary:'Minimum evidence and handling steps for staff-reported suspicious messages.', content:'Record sender, subject, received time, recipient scope and message identifiers. Do not paste live credentials or sensitive message bodies into case titles.', category:'PHISHING', author_id:actorIds.l2a, tags:['phishing','email','evidence'], source_incident_id:null, created_at:ago(240), updated_at:ago(240) },
    { id:uuid('6',5), title:'Denial-of-service initial response', summary:'A concise decision path for traffic saturation and application availability events.', content:'Validate service health, preserve traffic samples, confirm upstream controls, apply approved rate limits and maintain a timestamped impact log.', category:'DOS', author_id:actorIds.lead, tags:['availability','dos','network'], source_incident_id:null, created_at:ago(360), updated_at:ago(360) },
    { id:uuid('6',6), title:'Service-account lockout review', summary:'Distinguish expired credentials and configuration faults from hostile authentication attempts.', content:'Compare failure timing with credential rotation, identify dependent services, review source hosts and restore through the approved secrets process.', category:'UNAUTHORISED_ACCESS', author_id:actorIds.l2a, tags:['service-account','database','authentication'], source_incident_id:incidents[5].id, created_at:after(incidents[5].created_at,5), updated_at:after(incidents[5].created_at,5) },
  ];

  return { assets, incidents, incident_assets, comments, incident_updates, audit_log, kb_articles };
}
