import React, { useState } from 'react';
import { X, Play, RefreshCw, Radio } from 'lucide-react';
import { triggerScan } from '../api';

export default function ScanModal({ isOpen, onClose, onScanTriggered, scanStatus }) {
  const [target, setTarget] = useState('');
  const [limit, setLimit] = useState(2);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!target.trim()) return;
    setLoading(true);
    try {
      await triggerScan(target.trim(), limit);
      onScanTriggered();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '540px',
          padding: '28px',
          background: '#0d1322',
          border: '1px solid var(--border-glow)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>
          ⚡ Scan YouTube Video or Channel
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Paste any YouTube financial video URL or channel handle. Gemini 3.7 will extract stock tickers, buy levels, and targets.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              YouTube URL or Channel Handle
            </label>
            <input
              type="text"
              placeholder="e.g. https://www.youtube.com/watch?v=... or @MeetKevin"
              value={target}
              onChange={e => setTarget(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(2, 6, 23, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              If Channel, scan recent:
            </label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(2, 6, 23, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value={1}>Latest 1 Video</option>
              <option value={2}>Latest 2 Videos</option>
              <option value={3}>Latest 3 Videos</option>
              <option value={5}>Latest 5 Videos</option>
            </select>
          </div>

          {/* Current Live Scan Status Box */}
          {scanStatus?.is_scanning && (
            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.8rem',
              color: '#a5b4fc'
            }}>
              <RefreshCw size={16} className="animate-spin" />
              <span>{scanStatus.progress_message || 'Analyzing...'}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Play size={14} fill="#ffffff" />
              {loading ? 'Starting...' : 'Start Extraction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
