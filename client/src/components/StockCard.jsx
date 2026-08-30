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
        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
    >
      <div>
        {/* Top Bar: Ticker + Sentiment Badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-mono" style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {r.ticker}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                {r.market || 'US'}
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '2px' }}>
              {r.company_name}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className={`badge ${badgeClass}`}>
              {r.sentiment}
            </span>
            {r.stance_change === 'UPGRADED' && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: '900',
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'var(--color-buy-bg)',
                border: '1px solid var(--color-buy-border)',
                color: 'var(--color-buy)',
                letterSpacing: '0.02em'
              }}>
                🚀 UPGRADED
              </span>
            )}
            {r.stance_change === 'DOWNGRADED' && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: '900',
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'var(--color-sell-bg)',
                border: '1px solid var(--color-sell-border)',
                color: 'var(--color-sell)',
                letterSpacing: '0.02em'
              }}>
                🔻 DOWNGRADED
              </span>
            )}
            {r.stance_change === 'REITERATED' && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: '900',
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--color-brand)',
                letterSpacing: '0.02em'
              }}>
                🔁 REITERATED
              </span>
            )}
          </div>
        </div>

        {/* Strategy Type Pill & Stance Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {r.strategy_type && (
            <span style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              background: 'var(--bg-card-subtle)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-subtle)'
            }}>
              {r.strategy_type}
            </span>
          )}
          {r.previous_sentiment && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              was {r.previous_sentiment}
            </span>
          )}
        </div>

        {/* Key Price Levels Box */}
        <div style={{
          background: 'var(--bg-card-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
              Buy / Entry
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-buy)' }}>
              {r.buy_entry_zone || 'Market Price'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
              Target Price
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-accumulate)' }}>
              {r.target_price || 'Long Term Hold'}
            </span>
          </div>

          {r.stop_loss && (
            <div style={{ gridColumn: 'span 2', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-sell)', display: 'block', textTransform: 'uppercase' }}>
                Stop Loss: <strong>{r.stop_loss}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Creator's Quote Excerpt */}
        {r.quote_excerpt && (
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            lineHeight: '1.4',
            marginBottom: '16px',
            borderLeft: '2px solid var(--color-brand)',
            paddingLeft: '8px'
          }}>
            "{r.quote_excerpt}"
          </p>
        )}
      </div>

      {/* Footer Info: Channel + Video Link */}
      <div style={{
        paddingTop: '12px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'var(--color-brand-glow)',
            color: 'var(--color-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            fontWeight: 'bold'
          }}>
            {r.channel_name ? r.channel_name[0].toUpperCase() : 'Y'}
          </div>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
            {r.channel_name || 'YouTube Creator'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {r.timestamp_reference && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              background: 'var(--bg-card-subtle)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.7rem'
            }}>
              <Clock size={11} /> {r.timestamp_reference}
            </span>
          )}

          {r.video_url && (
            <a
              href={ytTimestampUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s'
              }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--color-brand)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
              title="Watch segment on YouTube"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
