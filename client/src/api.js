const API_BASE = '/api';

export async function fetchRecommendations({ search, ticker, sentiment, channel, market, days, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (ticker) params.append('ticker', ticker);
  if (sentiment && sentiment !== 'ALL') params.append('sentiment', sentiment);
  if (channel && channel !== 'ALL') params.append('channel', channel);
  if (market && market !== 'ALL') params.append('market', market);
  if (days && days !== 'ALL') params.append('days', days);
  params.append('limit', limit);
  params.append('offset', offset);

  const res = await fetch(`${API_BASE}/recommendations?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch recommendations');
  return res.json();
}

export async function fetchConsensus({ search, sentiment, channel, market, days, sortBy = 'mentions' } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (sentiment && sentiment !== 'ALL') params.append('sentiment', sentiment);
  if (channel && channel !== 'ALL') params.append('channel', channel);
  if (market && market !== 'ALL') params.append('market', market);
  if (days && days !== 'ALL') params.append('days', days);
  if (sortBy) params.append('sort_by', sortBy);

  const res = await fetch(`${API_BASE}/consensus?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch consensus');
  return res.json();
}


export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchChannels() {
  const res = await fetch(`${API_BASE}/channels`);
  if (!res.ok) throw new Error('Failed to fetch channels');
  return res.json();
}

export async function addChannel(urlOrHandle, name) {
  const res = await fetch(`${API_BASE}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url_or_handle: urlOrHandle, name })
  });
  if (!res.ok) throw new Error('Failed to add channel');
  return res.json();
}

export async function toggleChannel(channelId) {
  const res = await fetch(`${API_BASE}/channels/${channelId}/toggle`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to toggle channel');
  return res.json();
}

export async function deleteChannel(channelId) {
  const res = await fetch(`${API_BASE}/channels/${channelId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete channel');
  return res.json();
}


export async function triggerScan(target, limit = 2, afterDate = '') {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, limit, after_date: afterDate || null })
  });
  if (!res.ok) throw new Error('Failed to trigger scan');
  return res.json();
}

export async function triggerScanAll(limit = 2, afterDate = '') {
  const params = new URLSearchParams();
  params.append('limit', limit);
  if (afterDate) params.append('after_date', afterDate);

  const res = await fetch(`${API_BASE}/scan-all?${params.toString()}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to trigger scan all');
  return res.json();
}


export async function fetchScanStatus() {
  const res = await fetch(`${API_BASE}/scan/status`);
  if (!res.ok) throw new Error('Failed to fetch scan status');
  return res.json();
}

export async function clearScanQueue() {
  const res = await fetch(`${API_BASE}/queue/clear`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to clear queue');
  return res.json();
}


export async function fetchYoutubeAuthStatus() {
  const res = await fetch(`${API_BASE}/auth/youtube/status`);
  if (!res.ok) throw new Error('Failed to fetch YouTube auth status');
  return res.json();
}

export async function syncLiveYoutubeSubscriptions() {
  const res = await fetch(`${API_BASE}/auth/youtube/sync`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to sync YouTube subscriptions');
  }
  return res.json();
}

