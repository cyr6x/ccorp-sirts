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
