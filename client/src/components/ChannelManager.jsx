import React, { useState, useEffect } from 'react';
import { Tv, Plus, Play, Check, ExternalLink, RefreshCw, Radio, Link2, Sparkles, Trash2, Calendar, X } from 'lucide-react';
import {
  addChannel,
  toggleChannel,
  deleteChannel,
  triggerScan,
  triggerScanAll,
  fetchYoutubeAuthStatus,
  syncLiveYoutubeSubscriptions
} from '../api';

export default function ChannelManager({ channels = [], onRefresh, onTriggerScanAll, isScanning }) {
  const [newHandle, setNewHandle] = useState('');
  const [newName, setNewName] = useState('');
  const [scanLimit, setScanLimit] = useState(2);
  const [scanAfterDate, setScanAfterDate] = useState('');
  const [channelLimits, setChannelLimits] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch YouTube OAuth live status
  useEffect(() => {
    fetchYoutubeAuthStatus()
      .then(data => setAuthStatus(data))
      .catch(() => setAuthStatus(null));
  }, []);

  const handleLiveSync = async () => {
    if (!authStatus?.connected) {
      window.location.href = '/api/auth/youtube/login';
      return;
    }

    setIsSyncing(true);
    try {
      const res = await syncLiveYoutubeSubscriptions();
      alert(res.message || 'Synced successfully!');
      onRefresh();
    } catch (err) {
      if (err.message && (err.message.includes('401') || err.message.includes('connect'))) {
        window.location.href = '/api/auth/youtube/login';
      } else {
        alert(err.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newHandle.trim()) return;

    try {
      setIsSubmitting(true);
      await addChannel(newHandle.trim(), newName.trim() || undefined);
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
      await triggerScan(ch.url, limit, scanAfterDate);
      const dateMsg = scanAfterDate ? ` published after ${scanAfterDate}` : '';
      alert(`Enqueued up to ${limit} videos${dateMsg} from "${ch.name}" for sequential scan (already analyzed videos will skip automatically)!`);
    } catch (err) {
      alert(err.message);
    }
  };

  // Quick preset helper
  const setQuickDateOffset = (daysAgo) => {
    if (daysAgo === 0) {
      setScanAfterDate('');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setScanAfterDate(d.toISOString().slice(0, 10));
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top Banner: Monitored Channels + Scan All Actions */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.12)',
                color: 'var(--color-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Tv size={20} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                Monitored YouTube Creators
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
              The AI watcher scans these channels automatically to ingest new stock picks and key price levels.
            </p>
          </div>

          {/* Live YouTube Account Sync Button */}
          <button
            onClick={handleLiveSync}
            disabled={isSyncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: authStatus?.connected
                ? 'var(--color-buy-bg)'
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: authStatus?.connected ? '1px solid var(--color-buy-border)' : 'none',
              color: authStatus?.connected ? 'var(--color-buy)' : '#ffffff',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.8rem',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              boxShadow: authStatus?.connected ? 'none' : '0 4px 14px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            {isSyncing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : authStatus?.connected ? (
              <Check size={14} />
            ) : (
              <Link2 size={14} />
            )}
            {isSyncing
              ? 'Syncing with YouTube...'
              : authStatus?.connected
              ? '✓ Live Synced with YouTube'
              : '🔗 Connect YouTube Account'}
          </button>
        </div>

        {/* Scan All Controls Bar: Date Picker + Depth + Action Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          padding: '14px 18px',
          background: 'var(--bg-card-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px'
        }}>
          {/* Published After Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="var(--color-brand)" />
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Scan Videos After Date:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={scanAfterDate}
                onChange={e => setScanAfterDate(e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              {scanAfterDate && (
                <button
                  onClick={() => setScanAfterDate('')}
                  title="Clear Date Filter"
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Date Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setQuickDateOffset(1)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                24h
              </button>
              <button
                onClick={() => setQuickDateOffset(7)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                7 Days
              </button>
              <button
                onClick={() => setQuickDateOffset(30)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                30 Days
              </button>
              <button
                onClick={() => setQuickDateOffset(0)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                All
              </button>
            </div>
          </div>

          {/* Depth + Scan Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Depth:</span>
              <select
                value={scanLimit}
                onChange={e => setScanLimit(Number(e.target.value))}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={1}>Latest 1 Video</option>
                <option value={2}>Latest 2 Videos</option>
                <option value={3}>Latest 3 Videos</option>
                <option value={5}>Latest 5 Videos</option>
                <option value={10}>Latest 10 Videos</option>
                <option value={15}>All in Feed (15)</option>
              </select>
            </div>

            <button
              onClick={() => onTriggerScanAll(scanLimit, scanAfterDate)}
              disabled={isScanning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: isScanning ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)',
                opacity: isScanning ? 0.7 : 1
              }}
            >
              <RefreshCw size={15} className={isScanning ? 'animate-spin' : ''} />
              {isScanning ? 'Scanning All...' : 'Scan All Channels'}
            </button>
          </div>
        </div>
      </div>

      {/* Add Channel Form */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
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
              flex: '2 1 240px',
              padding: '10px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
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
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              background: 'var(--color-brand)',
              border: 'none',
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
                background: ch.enabled ? 'var(--color-buy-bg)' : 'var(--bg-card-subtle)',
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
                  <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
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
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    color: 'var(--color-brand)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: '700'
                  }}>
                    🎬 {ch.analyzed_videos_count || 0} Videos Tracked
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'var(--color-buy-bg)',
                    border: '1px solid var(--color-buy-border)',
                    color: 'var(--color-buy)',
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

            {/* Action Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--bg-card-subtle)',
              padding: '6px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)'
            }}>
              {/* Per-Channel Video Limit Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Fetch:</span>
                <select
                  value={channelLimits[ch.id] || 2}
                  onChange={e => setChannelLimits(prev => ({ ...prev, [ch.id]: parseInt(e.target.value) }))}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
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
                  <option value={15}>15 Videos</option>
                </select>
              </div>

              {/* Scan Button */}
              <button
                onClick={() => handleScanSingle(ch)}
                title="Scan channel (Skips already analyzed videos automatically)"
                style={{
                  background: 'var(--color-brand)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px var(--color-brand-glow)'
                }}
              >
                <Play size={12} fill="#ffffff" /> Scan Channel
              </button>

              {/* Toggle Enable/Disable */}
              <button
                onClick={() => handleToggle(ch.id)}
                style={{
                  background: ch.enabled ? 'var(--color-buy-bg)' : 'var(--color-sell-bg)',
                  border: ch.enabled ? '1px solid var(--color-buy-border)' : '1px solid var(--color-sell-border)',
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
                  background: 'var(--color-sell-bg)',
                  border: '1px solid var(--color-sell-border)',
                  color: 'var(--color-sell)',
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
