import React from 'react';
import { ExternalLink, Clock, ShieldAlert, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function StockCard({ recommendation, onOpenDetail }) {
  const r = recommendation;
  const s = (r.sentiment || 'BUY').toUpperCase();

  let badgeClass = 'badge-buy';
  if (s.includes('ACCUMULATE')) badgeClass = 'badge-accumulate';
  else if (s.includes('WATCHLIST') || s.includes('HOLD')) badgeClass = 'badge-watchlist';
  else if (s.includes('SELL') || s.includes('AVOID')) badgeClass = 'badge-sell';

  // Construct clickable YouTube timestamp link
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
      className="glass-panel animate-fade-in"
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={() => onOpenDetail(r)}
      onMouseOver={e => {
        e.currentTarget.style.borderColor = 'var(--border-glow)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.4)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div>
        {/* Top Bar: Ticker + Sentiment Badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-mono" style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff' }}>
                ${r.ticker}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                {r.market || 'US'}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '2px' }}>
              {r.company_name}
            </p>
          </div>

          <span className={`badge ${badgeClass}`}>
            {r.sentiment}
          </span>
        </div>

        {/* Strategy Type Pill */}
        {r.strategy_type && (
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {r.strategy_type}
            </span>
          </div>
        )}

        {/* Key Price Levels Box */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.6)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px'
        }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>
              Buy / Entry Zone
            </span>
            <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--color-buy)', fontWeight: '700' }}>
              {r.buy_entry_zone || 'Market Price'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>
              Target Price
            </span>
            <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--color-accumulate)', fontWeight: '700' }}>
              {r.target_price || '—'}
            </span>
          </div>
        </div>

        {/* Top Thesis Catalyst */}
        {r.thesis && r.thesis.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '3px' }} />
              <p style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.4'
              }}>
                {r.thesis[0]}
              </p>
            </div>
          </div>
        )}

        {/* Direct Quote Excerpt */}
        {r.quote_excerpt && (
          <div style={{
            fontStyle: 'italic',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            borderLeft: '2px solid rgba(99, 102, 241, 0.4)',
            paddingLeft: '8px',
            marginBottom: '16px',
            lineHeight: '1.3'
          }}>
            "{r.quote_excerpt}"
          </div>
        )}
      </div>

      {/* Footer: Channel + Date + Timestamp Link */}
      <div style={{
        paddingTop: '12px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: '700', color: '#ffffff' }}>
            {r.channel_name || 'YouTube Creator'}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            📅 {r.published_at ? new Date(r.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent')}
          </span>
        </div>

        <a
          href={ytTimestampUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#a5b4fc',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            padding: '4px 8px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '700',
            fontSize: '0.75rem'
          }}
        >
          <Clock size={12} />
          {r.timestamp_reference || 'Watch Video'}
          <ArrowUpRight size={12} />
        </a>
      </div>

    </div>
  );
}
