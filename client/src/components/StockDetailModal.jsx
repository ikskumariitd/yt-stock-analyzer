import React from 'react';
import { X, ExternalLink, ShieldAlert, CheckCircle2, Play, Calendar, User, Clock, AlertTriangle } from 'lucide-react';

export default function StockDetailModal({ recommendation, onClose }) {
  if (!recommendation) return null;
  const r = recommendation;

  // Build timestamped link
  let ytTimestampUrl = r.video_url || '#';
  if (r.timestamp_reference && ytTimestampUrl.includes('youtube.com')) {
    const parts = r.timestamp_reference.split(':');
    let totalSec = 0;
    if (parts.length === 2) {
      totalSec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
      totalSec = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    ytTimestampUrl = `${ytTimestampUrl}&t=${totalSec}s`;
  }

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
          maxWidth: '700px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
          background: '#0d1322',
          border: '1px solid var(--border-glow)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
        >
          <X size={20} />
        </button>

        {/* Header Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span className="font-mono" style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>
              ${r.ticker}
            </span>
            <span className="badge badge-buy" style={{ fontSize: '0.85rem' }}>
              {r.sentiment}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              {r.market || 'US'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
            {r.company_name}
          </h2>
        </div>

        {/* Price & Strategy Highlights */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          background: 'rgba(2, 6, 23, 0.8)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
              Buy / Entry Zone
            </span>
            <span className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--color-buy)', fontWeight: '700' }}>
              {r.buy_entry_zone || 'Market Price'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
              Target Price
            </span>
            <span className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--color-accumulate)', fontWeight: '700' }}>
              {r.target_price || '—'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
              Stop Loss
            </span>
            <span className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--color-sell)', fontWeight: '700' }}>
              {r.stop_loss || 'None stated'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
              Time Horizon
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '600' }}>
              {r.time_horizon || 'Medium-term'}
            </span>
          </div>
        </div>

        {/* Video Source Banner */}
        <div style={{
          padding: '12px 16px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '24px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#a5b4fc', fontWeight: '600' }}>
              <User size={14} /> {r.channel_name}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: '500', marginTop: '2px' }}>
              {r.video_title}
            </p>
          </div>

          <a
            href={ytTimestampUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ef4444',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.8rem',
              fontWeight: '700',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
            }}
          >
            <Play size={14} fill="#ffffff" />
            Watch at {r.timestamp_reference || '0:00'}
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Direct Quote */}
        {r.quote_excerpt && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: '4px solid var(--color-brand)',
            padding: '14px 18px',
            borderRadius: '0 8px 8px 0',
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: '#cbd5e1',
            lineHeight: '1.5',
            marginBottom: '24px'
          }}>
            "{r.quote_excerpt}"
          </div>
        )}

        {/* Catalysts & Thesis */}
        {r.thesis && r.thesis.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <CheckCircle2 size={18} color="#10b981" /> Investment Thesis & Catalysts
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {r.thesis.map((point, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Risks */}
        {r.risks && r.risks.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={18} color="#f59e0b" /> Highlighted Risks & Caveats
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {r.risks.map((risk, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: '#fca5a5', lineHeight: '1.4' }}>
                  <span style={{ color: '#f87171', fontWeight: 'bold' }}>⚠️</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
