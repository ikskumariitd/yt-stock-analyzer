import React, { useState, useEffect } from 'react';
import { Tv, Plus, Play, Check, ExternalLink, RefreshCw, Radio, Link2, Sparkles, Trash2 } from 'lucide-react';
import {
  addChannel,
  toggleChannel,
  deleteChannel,
  triggerScan,
  triggerScanAll,
  fetchYoutubeAuthStatus,
  syncLiveYoutubeSubscriptions
} from '../api';


export default function ChannelManager({ channels, onRefresh, onTriggerScanAll, isScanning }) {
  const [newHandle, setNewHandle] = useState('');
  const [newName, setNewName] = useState('');
  const [scanLimit, setScanLimit] = useState(3);
  const [channelLimits, setChannelLimits] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Fetch YouTube OAuth live status
  useEffect(() => {
    fetchYoutubeAuthStatus()
      .then(data => setAuthStatus(data))
      .catch(() => setAuthStatus(null));
  }, []);

  const handleSyncSubscriptions = async () => {
    try {
      setIsSyncing(true);
      setSyncMessage('Connecting to YouTube API and fetching subscriptions...');
      const res = await syncLiveYoutubeSubscriptions();
      setSyncMessage(`✓ Synced ${res.channels_count} channels successfully!`);
      onRefresh();
    } catch (err) {
      setSyncMessage(`⚠️ Error syncing: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 6000);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newHandle.trim()) return;

    try {
      setIsSubmitting(true);
      await addChannel(newHandle.trim(), newName.trim());
      setNewHandle('');
      setNewName('');
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await toggleChannel(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from monitored channels?`)) return;
    try {
      await deleteChannel(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleScanSingle = async (ch) => {
    const limit = channelLimits[ch.id] || 2;
    try {
      await triggerScan(ch.url, limit);
      alert(`Enqueued latest ${limit} videos from "${ch.name}" for sequential scan (already analyzed videos will skip automatically)!`);
    } catch (err) {
      alert(err.message);
    }
  };


  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top Banner & Batch Scan */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tv size={22} color="#6366f1" /> Monitored YouTube Creators ({channels?.length || 0})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            The AI watcher scans these channels automatically to ingest new stock picks and key price levels.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Live YouTube Account Sync Button */}
          <button
            onClick={handleLiveSync}
            disabled={isSyncingLive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: authStatus?.connected
                ? 'rgba(16, 185, 129, 0.15)'
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: authStatus?.connected ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
              color: authStatus?.connected ? 'var(--color-buy)' : '#ffffff',
              padding: '10px 16px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: isSyncingLive ? 'not-allowed' : 'pointer',
              boxShadow: authStatus?.connected ? 'none' : '0 4px 14px rgba(239, 68, 68, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            {isSyncingLive ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : authStatus?.connected ? (
              <Check size={16} />
            ) : (
              <Link2 size={16} />
            )}
            {isSyncingLive
              ? 'Syncing with YouTube...'
              : authStatus?.connected
              ? '✓ Live Synced with YouTube'
              : '🔗 Connect YouTube Account (Live Sync)'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Depth:</span>
            <select
              value={scanLimit}
              onChange={e => setScanLimit(Number(e.target.value))}
              style={{
                background: 'rgba(2, 6, 23, 0.7)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem'
              }}
            >
              <option value={1}>Latest 1 Video</option>
              <option value={2}>Latest 2 Videos</option>
              <option value={3}>Latest 3 Videos</option>
              <option value={5}>Latest 5 Videos</option>
            </select>
          </div>

          <button
            onClick={() => onTriggerScanAll(scanLimit)}
            disabled={isScanning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
              opacity: isScanning ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
            {isScanning ? 'Scanning All...' : 'Scan All Channels'}
          </button>
        </div>
      </div>

      {/* Add Channel Form */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>
          + Add New YouTube Creator
        </h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <input
            type="text"
            placeholder="Channel Handle (@MeetKevin) or Full URL"
            value={newHandle}
            onChange={e => setNewHandle(e.target.value)}
            required
            style={{
              flex: '2 1 250px',
              padding: '10px 14px',
              background: 'rgba(2, 6, 23, 0.7)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Optional Display Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{
              flex: '1 1 180px',
              padding: '10px 14px',
              background: 'rgba(2, 6, 23, 0.7)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} /> Add Creator
          </button>
        </form>
      </div>

      {/* Channels List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(channels || []).map(ch => (
          <div
            key={ch.id || ch.url}
            className="glass-panel"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: ch.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: ch.enabled ? 'var(--color-buy)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '1.1rem'
              }}>
                {ch.name ? ch.name[0].toUpperCase() : 'Y'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#ffffff' }}>
                    {ch.name}
                  </h4>
                  <a
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {ch.handle || ch.url} <ExternalLink size={10} />
                  </a>
                </div>

                {/* Tracked Videos & Picks Stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#a5b4fc',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: '700'
                  }}>
                    🎬 {ch.analyzed_videos_count || 0} Videos Tracked
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: '700'
                  }}>
                    📈 {ch.stock_picks_count || 0} Stock Calls
                  </span>
                  {ch.last_scanned_at && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • Last scanned: {new Date(ch.last_scanned_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Encircled Action Controls with Per-Channel Fetch Limit */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(2, 6, 23, 0.5)',
              padding: '6px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {/* Per-Channel Video Limit Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Fetch:</span>
                <select
                  value={channelLimits[ch.id] || 2}
                  onChange={e => setChannelLimits(prev => ({ ...prev, [ch.id]: parseInt(e.target.value) }))}
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  title="Number of recent videos to check (duplicates will be skipped)"
                >
                  <option value={1}>1 Video</option>
                  <option value={2}>2 Videos</option>
                  <option value={3}>3 Videos</option>
                  <option value={5}>5 Videos</option>
                  <option value={10}>10 Videos</option>
                </select>
              </div>

              {/* Scan Button */}
              <button
                onClick={() => handleScanSingle(ch)}
                title="Scan channel (Skips already analyzed videos automatically)"
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(16, 185, 129, 0.3))',
                  border: '1px solid rgba(99, 102, 241, 0.5)',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Play size={12} fill="#ffffff" /> Scan Channel
              </button>

              {/* Toggle Enable/Disable */}
              <button
                onClick={() => handleToggle(ch.id)}
                style={{
                  background: ch.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                  border: ch.enabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
                  color: ch.enabled ? 'var(--color-buy)' : 'var(--color-sell)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {ch.enabled ? 'ENABLED' : 'DISABLED'}
              </button>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(ch.id, ch.name)}
                title="Remove Channel"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
