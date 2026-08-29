import React, { useState, useEffect } from 'react';
import { Tv, Plus, Play, Check, ExternalLink, RefreshCw, Radio, Link2, Sparkles } from 'lucide-react';
import {
  addChannel,
  toggleChannel,
  triggerScan,
  triggerScanAll,
  fetchYoutubeAuthStatus,
  syncLiveYoutubeSubscriptions
} from '../api';

export default function ChannelManager({ channels, onRefresh, onTriggerScanAll, isScanning }) {
  const [newHandle, setNewHandle] = useState('');
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanLimit, setScanLimit] = useState(2);
  const [authStatus, setAuthStatus] = useState(null);
  const [isSyncingLive, setIsSyncingLive] = useState(false);

  useEffect(() => {
    fetchYoutubeAuthStatus().then(setAuthStatus).catch(() => {});
  }, []);

  const handleLiveSync = async () => {
    if (!authStatus?.connected) {
      // Redirect to Google login
      window.location.href = '/api/auth/youtube/login';
      return;
    }

    setIsSyncingLive(true);
    try {
      const res = await syncLiveYoutubeSubscriptions();
      alert(res.message);
      onRefresh();
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('connect')) {
        window.location.href = '/api/auth/youtube/login';
      } else {
        alert(err.message);
      }
    } finally {
      setIsSyncingLive(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newHandle.trim()) return;
    setIsSubmitting(true);
    try {
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

  const handleScanSingle = async (url) => {
    try {
      await triggerScan(url, scanLimit);
      alert(`Started background scan for ${url}!`);
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
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: ch.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: ch.enabled ? 'var(--color-buy)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '1rem'
              }}>
                {ch.name ? ch.name[0].toUpperCase() : 'Y'}
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff' }}>
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
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {ch.last_scanned_at && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Last scanned: {new Date(ch.last_scanned_at).toLocaleDateString()}
                </span>
              )}

              <button
                onClick={() => handleScanSingle(ch.url)}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#a5b4fc',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Play size={12} fill="#a5b4fc" /> Scan Channel
              </button>

              <button
                onClick={() => handleToggle(ch.id)}
                style={{
                  background: ch.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                  border: ch.enabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
                  color: ch.enabled ? 'var(--color-buy)' : 'var(--color-sell)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {ch.enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
