import React from 'react';
import { X, ExternalLink, ShieldAlert, CheckCircle2, Play, Calendar, User, Clock, AlertTriangle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { formatSingaporeDate } from '../utils/timeUtils';

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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--bg-card-subtle)'}
        >
          <X size={20} />
        </button>

        {/* Header Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span className="font-mono" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--color-brand)' }}>
              {r.ticker}
            </span>

            <span className="badge badge-buy" style={{ fontSize: '0.85rem' }}>
              {r.sentiment}
            </span>

            {r.stance_change === 'UPGRADED' && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '800',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--color-buy-bg)',
                border: '1px solid var(--color-buy-border)',
                color: 'var(--color-buy)'
              }}>
                🚀 UPGRADED CALL
              </span>
            )}
            {r.stance_change === 'DOWNGRADED' && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '800',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--color-sell-bg)',
                border: '1px solid var(--color-sell-border)',
                color: 'var(--color-sell)'
              }}>
                🔻 DOWNGRADED CALL
              </span>
            )}
            {r.stance_change === 'REITERATED' && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '800',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--color-brand)'
              }}>
                🔁 REITERATED
              </span>
            )}

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              {r.market || 'US'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {r.company_name}
          </h2>
        </div>

        {/* Stance Evolution Banner (When creator has prior coverage) */}
        {r.previous_sentiment && (
          <div style={{
            padding: '12px 16px',
            background: r.stance_change === 'UPGRADED' ? 'var(--color-buy-bg)' : (r.stance_change === 'DOWNGRADED' ? 'var(--color-sell-bg)' : 'rgba(99, 102, 241, 0.08)'),
            border: r.stance_change === 'UPGRADED' ? '1px solid var(--color-buy-border)' : (r.stance_change === 'DOWNGRADED' ? '1px solid var(--color-sell-border)' : '1px solid rgba(99, 102, 241, 0.2)'),
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {r.stance_change === 'UPGRADED' ? (
                <TrendingUp size={18} color="var(--color-buy)" />
              ) : r.stance_change === 'DOWNGRADED' ? (
                <TrendingDown size={18} color="var(--color-sell)" />
              ) : (
                <RefreshCw size={16} color="var(--color-brand)" />
              )}
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Creator Stance Shift: {r.previous_sentiment} ➔ {r.sentiment}
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Call #{r.call_sequence_index || 2} of {r.total_creator_calls || 2} by {r.channel_name} {r.previous_published_at ? `(prev: ${formatSingaporeDate(r.previous_published_at)})` : ''}
            </span>
          </div>
        )}

        {/* Price & Strategy Highlights */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          background: 'var(--bg-card-subtle)',
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
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '24px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--color-brand)', fontWeight: '700' }}>
              <User size={14} /> {r.channel_name}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginTop: '2px' }}>
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
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
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
            background: 'var(--bg-card-subtle)',
            borderLeft: '4px solid var(--color-brand)',
            padding: '14px 18px',
            borderRadius: '0 8px 8px 0',
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            marginBottom: '24px'
          }}>
            "{r.quote_excerpt}"
          </div>
        )}

        {/* Catalysts & Thesis */}
        {r.thesis && r.thesis.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <CheckCircle2 size={18} color="var(--color-buy)" /> Investment Thesis & Catalysts
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {r.thesis.map((point, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  <span style={{ color: 'var(--color-buy)', fontWeight: 'bold' }}>•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Risks */}
        {r.risks && r.risks.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={18} color="var(--color-watchlist)" /> Highlighted Risks & Caveats
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {r.risks.map((risk, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: 'var(--color-sell)', lineHeight: '1.4' }}>
                  <span style={{ color: 'var(--color-sell)', fontWeight: 'bold' }}>⚠️</span>
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
