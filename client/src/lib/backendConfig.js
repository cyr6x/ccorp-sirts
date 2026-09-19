export const RETIRED_PROJECTS = [
  'tvjyllnfuptdcbirjvev', 'oslthmbnukpkywapdkje', 'pvtissqcpskpxlduxuta',
  'txphvpzcbamricsskvoe', 'qurgnzdxrkkvapsofzcs',
];

export function validateBackendConfig(env) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const expected = env.VITE_SUPABASE_PROJECT_REF?.trim();
  if (!url || !key || !expected) throw new Error('The recovery workspace has not been connected to its new backend yet.');
  const parsed = new URL(url);
  if (!/^[a-z]{20}$/.test(expected) || parsed.origin !== `https://${expected}.supabase.co` ||
      parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('The backend address does not match the configured recovery project.');
  }
  if (RETIRED_PROJECTS.includes(expected)) throw new Error('This recovery workspace cannot connect to a previous SIRTS project.');
  if (!key.startsWith('sb_publishable_')) throw new Error('A Supabase publishable key is required. Secret and legacy keys are not accepted.');
  return { url: parsed.origin, key, projectRef: expected };
}
