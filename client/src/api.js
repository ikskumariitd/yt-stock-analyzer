const API_BASE = '/api';

export async function fetchRecommendations({ search, ticker, sentiment, channel, market, days, stanceChange, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (ticker) params.append('ticker', ticker);
  if (sentiment && sentiment !== 'ALL') params.append('sentiment', sentiment);
  if (channel && channel !== 'ALL') params.append('channel', channel);
  if (market && market !== 'ALL') params.append('market', market);
  if (days && days !== 'ALL') params.append('days', days);
  if (stanceChange && stanceChange !== 'ALL') params.append('stance_change', stanceChange);
  params.append('limit', limit);
  params.append('offset', offset);

  const res = await fetch(`${API_BASE}/recommendations?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch recommendations');
  return res.json();
}

export async function fetchConsensus({ search, sentiment, channel, market, days, stanceChange, sortBy = 'mentions' } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (sentiment && sentiment !== 'ALL') params.append('sentiment', sentiment);
  if (channel && channel !== 'ALL') params.append('channel', channel);
  if (market && market !== 'ALL') params.append('market', market);
  if (days && days !== 'ALL') params.append('days', days);
  if (stanceChange && stanceChange !== 'ALL') params.append('stance_change', stanceChange);
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

export async function fetchChannelVideos(channelId) {
  const res = await fetch(`${API_BASE}/channels/${channelId}/videos`);
  if (!res.ok) throw new Error('Failed to fetch creator videos');
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
  const res = await fetch(`${API_BASE}/scan/queue`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to clear scan queue');
  return res.json();
}

export async function fetchScanAudit({ status, platform, search, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'ALL') params.append('status', status);
  if (platform && platform !== 'ALL') params.append('platform', platform);
  if (search) params.append('search', search);
  params.append('limit', limit);
  params.append('offset', offset);

  const res = await fetch(`${API_BASE}/scan/audit?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch scan audit logs');
  return res.json();
}

export async function rescanVideo({ videoId, url, channelName, title, platform }) {
  const res = await fetch(`${API_BASE}/scan/rescan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_id: videoId,
      url,
      channel_name: channelName,
      title,
      platform
    })
  });
  if (!res.ok) throw new Error('Failed to trigger rescan');
  return res.json();
}

export async function purgeAuditLogs(statuses = ['SKIPPED', 'FAILED', 'FAIL', 'TOO LONG', 'TOO_LONG', 'RERUN PASSED', 'RERUN_PASSED', 'PASSED (RERUN)']) {
  const res = await fetch(`${API_BASE}/scan/audit/purge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statuses })
  });
  if (!res.ok) throw new Error('Failed to purge audit logs');
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

export async function fetchSchedulerStatus() {
  const res = await fetch(`${API_BASE}/scheduler/status`);
  if (!res.ok) throw new Error('Failed to fetch scheduler status');
  return res.json();
}

export async function updateSchedulerConfig(enabled, runsPerDay = 4) {
  const res = await fetch(`${API_BASE}/scheduler/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, runs_per_day: runsPerDay })
  });
  if (!res.ok) throw new Error('Failed to update scheduler config');
  return res.json();
}

export async function triggerSchedulerRunNow() {
  const res = await fetch(`${API_BASE}/scheduler/run-now`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to trigger immediate auto-scan');
  return res.json();
}

