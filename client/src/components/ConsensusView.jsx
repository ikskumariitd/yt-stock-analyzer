import React, { useState } from 'react';
import {
  TrendingUp,
  Target,
  ShieldAlert,
  Clock,
  ExternalLink,
  Users,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles
} from 'lucide-react';

const SENTIMENT_COLORS = {
  STRONG_BUY: { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399', label: 'STRONG BUY' },
  BUY: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', label: 'BUY' },
  ACCUMULATE: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa', label: 'ACCUMULATE' },
  WATCHLIST: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)', text: '#facc15', label: 'WATCHLIST' },
  HOLD: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)', text: '#facc15', label: 'HOLD' },
  SELL: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171', label: 'SELL' },
  AVOID: { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)', text: '#f87171', label: 'AVOID' }
};

export default function ConsensusView({ consensusData = [], onSelectStock }) {
  const [expandedTickers, setExpandedTickers] = useState({});

  const toggleExpand = (ticker) => {
    setExpandedTickers(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }));
  };

  if (!consensusData.length) {
    return (
      <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', margin: '40px 0' }}>
        <Layers size={40} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>No matching consensus stocks found</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>
          Try clearing your search or adjusting your filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
      {consensusData.map(stock => {
        const isExpanded = expandedTickers[stock.ticker] !== false; // Default expanded
        const domSentStyle = SENTIMENT_COLORS[stock.dominant_sentiment] || SENTIMENT_COLORS.BUY;

        return (
          <div
            key={stock.ticker}
            className="glass-panel"
            style={{
              padding: '24px',
              borderRadius: '16px',
              border: stock.total_calls > 1 ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-subtle)',
              boxShadow: stock.total_calls > 1 ? '0 8px 30px rgba(99, 102, 241, 0.1)' : 'none'
            }}
          >
            {/* Stock Group Header */}
            <div
              onClick={() => toggleExpand(stock.ticker)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  padding: '8px 16px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '10px',
                  fontWeight: '900',
                  fontSize: '1.4rem',
                  color: '#ffffff',
                  letterSpacing: '0.05em'
                }}>
                  ${stock.ticker}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>
                      {stock.company_name}
                    </h3>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: domSentStyle.bg,
                      border: `1px solid ${domSentStyle.border}`,
                      color: domSentStyle.text,
                      fontSize: '0.75rem',
                      fontWeight: '800'
                    }}>
                      CONSENSUS: {domSentStyle.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a5b4fc', fontWeight: '700' }}>
                      <Users size={14} /> {stock.total_calls} Reviews from {stock.unique_creators} {stock.unique_creators === 1 ? 'Creator' : 'Creators'}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} /> Latest: {stock.latest_date ? new Date(stock.latest_date).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Summary Targets Pill */}
                {stock.targets.length > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Target Targets</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-buy)' }}>
                      {stock.targets.slice(0, 2).join(' / ')}
                    </span>
                  </div>
                )}

                <button
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    padding: '8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>
            </div>

            {/* Expanded List of Creator Reviews */}
            {isExpanded && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Creator Breakdown & Video Timestamps:
                </div>

                {stock.calls.map((call, idx) => {
                  const sentStyle = SENTIMENT_COLORS[call.sentiment] || SENTIMENT_COLORS.BUY;
                  const formattedDate = call.published_at
                    ? new Date(call.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : (call.created_at ? new Date(call.created_at).toLocaleDateString() : 'Recent');

                  return (
                    <div
                      key={call.id || idx}
                      style={{
                        background: 'rgba(2, 6, 23, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      {/* Top Bar: Creator, Date, Sentiment */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '800'
                          }}>
                            {call.channel_name ? call.channel_name[0].toUpperCase() : 'Y'}
                          </div>
                          <div>
                            <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#ffffff' }}>
                              {call.channel_name}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              Covered on {formattedDate}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: sentStyle.bg,
                            border: `1px solid ${sentStyle.border}`,
                            color: sentStyle.text,
                            fontSize: '0.75rem',
                            fontWeight: '800'
                          }}>
                            {sentStyle.label}
                          </span>
                          {call.strategy_type && (
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              {call.strategy_type.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Video Title */}
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        "{call.video_title}"
                      </p>

                      {/* Levels Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '8px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '10px 14px',
                        borderRadius: '8px'
                      }}>
                        {call.buy_entry_zone && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Entry / Buy Zone</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-buy)' }}>
                              {call.buy_entry_zone}
                            </span>
                          </div>
                        )}
                        {call.target_price && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Target Price</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-accent)' }}>
                              {call.target_price}
                            </span>
                          </div>
                        )}
                        {call.stop_loss && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Stop Loss</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-sell)' }}>
                              {call.stop_loss}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quote excerpt */}
                      {call.quote_excerpt && (
                        <div style={{
                          borderLeft: '2px solid rgba(99, 102, 241, 0.5)',
                          paddingLeft: '10px',
                          fontSize: '0.8rem',
                          color: '#cbd5e1',
                          lineHeight: '1.4'
                        }}>
                          "{call.quote_excerpt}"
                        </div>
                      )}

                      {/* Actions: Watch on YouTube & Deep Dive Modal */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => onSelectStock && onSelectStock(call)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#818cf8',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            padding: '0',
                            textDecoration: 'underline'
                          }}
                        >
                          View Full Thesis & Risks →
                        </button>

                        {call.video_url && (
                          <a
                            href={call.video_url + (call.timestamp_reference && !call.video_url.includes('&t=') ? `&t=${parseInt(call.timestamp_reference) || 0}s` : '')}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              textDecoration: 'none'
                            }}
                          >
                            <ExternalLink size={12} /> Watch Video Segment
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
