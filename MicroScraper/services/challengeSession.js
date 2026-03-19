const pendingChallengeRequests = new Map();
let challengeRequestCounter = 0;

const makeRequestId = () => {
  challengeRequestCounter += 1;
  return `${Date.now()}-${challengeRequestCounter}`;
};

export const createChallengeRequest = (payload) => {
  const requestId = makeRequestId();
  let resolver = null;

  const promise = new Promise((resolve) => {
    resolver = resolve;
  });

  pendingChallengeRequests.set(requestId, {
    payload,
    resolve: resolver,
    createdAt: Date.now(),
  });

  return { requestId, promise };
};

export const getChallengeRequest = (requestId) => {
  if (!requestId) return null;
  return pendingChallengeRequests.get(String(requestId)) || null;
};

export const resolveChallengeRequest = (requestId, result) => {
  const key = String(requestId || '');
  const existing = pendingChallengeRequests.get(key);
  if (!existing) return false;

  pendingChallengeRequests.delete(key);
  existing.resolve(result);
  return true;
};
