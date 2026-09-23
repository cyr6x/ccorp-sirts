export function createRequestGate() {
  let latestRequest = 0;

  return {
    begin() {
      latestRequest += 1;
      return latestRequest;
    },
    isCurrent(requestId) {
      return requestId === latestRequest;
    },
  };
}

export function reportFilterKey(filters) {
  return JSON.stringify(filters);
}

// The page and the regression test share this publish boundary. A superseded
// response is never allowed to update either the display or the export rows.
export async function loadFilteredReports(gate, filterKey, request, publish) {
  const requestId = gate.begin();
  try {
    const result = await request();
    if (gate.isCurrent(requestId)) publish({ filterKey, ...result });
  } catch (error) {
    if (gate.isCurrent(requestId)) publish({ filterKey, error });
  }
}
