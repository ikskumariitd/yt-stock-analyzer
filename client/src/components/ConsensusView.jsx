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
  Sparkles,
  CheckCircle2,
  Video,
  Eye,
  EyeOff
} from 'lucide-react';

const SENTIMENT_COLORS = {
  STRONG_BUY: { bg: 'var(--color-buy-bg)', border: 'var(--color-buy-border)', text: 'var(--color-buy)', label: 'STRONG BUY', bar: '#10b981' },
  BUY: { bg: 'var(--color-buy-bg)', border: 'var(--color-buy-border)', text: 'var(--color-buy)', label: 'BUY', bar: '#10b981' },
  ACCUMULATE: { bg: 'var(--color-accumulate-bg)', border: 'var(--color-accumulate-border)', text: 'var(--color-accumulate)', label: 'ACCUMULATE', bar: '#0284c7' },
  WATCHLIST: { bg: 'var(--color-watchlist-bg)', border: 'var(--color-watchlist-border)', text: 'var(--color-watchlist)', label: 'WATCHLIST', bar: '#d97706' },
  HOLD: { bg: 'var(--color-watchlist-bg)', border: 'var(--color-watchlist-border)', text: 'var(--color-watchlist)', label: 'HOLD', bar: '#d97706' },
  SELL: { bg: 'var(--color-sell-bg)', border: 'var(--color-sell-border)', text: 'var(--color-sell)', label: 'SELL', bar: '#e11d48' },
  AVOID: { bg: 'var(--color-sell-bg)', border: 'var(--color-sell-border)', text: 'var(--color-sell)', label: 'AVOID', bar: '#e11d48' }
};

export default function ConsensusView({ consensusData = [], onSelectStock }) {
  // Default all cards closed / collapsed
  const [expandedTickers, setExpandedTickers] = useState({});

  const toggleExpand = (ticker) => {
    setExpandedTickers(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }));
  };

  const expandAll = () => {
    const all = {};
    consensusData.forEach(s => { all[s.ticker] = true; });
    setExpandedTickers(all);
  };

  const collapseAll = () => {
    setExpandedTickers({});
  };

  const hasAnyExpanded = Object.values(expandedTickers).some(Boolean);

  if (!consensusData.length) {
    return (
      <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', margin: '40px 0' }}>
        <Layers size={40} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>No matching consensus stocks found</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>
          Try clearing your search or adjusting your date timeframe.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
      {/* Top Header Controls: Quick Bulk Expand / Collapse */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
          Found <strong style={{ color: 'var(--text-primary)' }}>{consensusData.length}</strong> Stocks with Multi-Creator Intelligence
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={hasAnyExpanded ? collapseAll : expandAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              transition: 'all 0.15s ease'
            }}
          >
            {hasAnyExpanded ? (
              <><EyeOff size={14} /> Collapse All</>
            ) : (
              <><Eye size={14} /> Expand All</>
            )}
          </button>
        </div>
      </div>

      {/* Stock Cards List */}
      {consensusData.map((stock) => {
        const isExpanded = !!expandedTickers[stock.ticker]; // Default collapsed
        const domSentStyle = SENTIMENT_COLORS[stock.dominant_sentiment] || SENTIMENT_COLORS.BUY;

        return (
          <div
            key={stock.ticker}
            className="animate-fade-in"
            style={{
              position: 'relative',
              borderRadius: '16px',
              background: 'var(--bg-card)',
              border: isExpanded ? '1px solid var(--color-brand)' : '1px solid var(--border-subtle)',
              boxShadow: isExpanded
                ? '0 12px 32px rgba(99, 102, 241, 0.12), 0 4px 12px rgba(0, 0, 0, 0.05)'
                : 'var(--shadow-card)',
              overflow: 'hidden',
              transition: 'all 0.2s ease'
            }}
          >
            {/* Top Accent Gradient Bar */}
            <div style={{
              height: '3px',
              width: '100%',
              background: `linear-gradient(90deg, #6366f1 0%, ${domSentStyle.bar} 45%, transparent 100%)`
            }} />

            {/* Clickable Main Stock Header (Click to Open/Close) */}
            <div
              onClick={() => toggleExpand(stock.ticker)}
              style={{
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                cursor: 'pointer',
                userSelect: 'none',
                background: isExpanded ? 'var(--bg-card-subtle)' : 'transparent',
                borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
                transition: 'background 0.2s ease'
              }}
            >
              {/* Left: Ticker, Name, Consensus */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  padding: '8px 16px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: '10px',
                  fontWeight: '900',
                  fontSize: '1.35rem',
                  color: 'var(--color-brand)',
                  letterSpacing: '0.04em',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)'
                }}>
                  {stock.ticker}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
                      {stock.company_name}
                    </h3>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: domSentStyle.bg,
                      border: `1px solid ${domSentStyle.border}`,
                      color: domSentStyle.text,
                      fontSize: '0.75rem',
                      fontWeight: '900',
                      letterSpacing: '0.04em'
                    }}>
                      CONSENSUS: {domSentStyle.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-brand)', fontWeight: '700' }}>
                      <Users size={14} /> {stock.total_calls} {stock.total_calls === 1 ? 'Review' : 'Reviews'} across {stock.unique_creators} {stock.unique_creators === 1 ? 'Creator' : 'Creators'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} /> Latest: {stock.latest_date ? new Date(stock.latest_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Targets & Expand/Close Toggle Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {stock.targets.length > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Price Targets</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-buy)' }}>
                      {stock.targets.slice(0, 2).join(' / ')}
                    </span>
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(stock.ticker);
                  }}
                  style={{
                    background: isExpanded ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card-subtle)',
                    border: isExpanded ? '1px solid var(--color-brand)' : '1px solid var(--border-subtle)',
                    color: isExpanded ? 'var(--color-brand)' : 'var(--text-primary)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isExpanded ? (
                    <>Hide <ChevronUp size={16} /></>
                  ) : (
                    <>View {stock.total_calls} {stock.total_calls === 1 ? 'Review' : 'Reviews'} <ChevronDown size={16} /></>
                  )}
                </button>
              </div>
            </div>

            {/* Creator Badges Preview when Collapsed */}
            {!isExpanded && stock.creator_names && stock.creator_names.length > 0 && (
              <div style={{
                padding: '0 24px 14px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>Creators:</span>
                {stock.creator_names.map(cName => (
                  <span
                    key={cName}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    👤 {cName}
                  </span>
                ))}
              </div>
            )}

            {/* Expanded Detailed Creator Reviews with Connected Left Timeline Rail */}
            {isExpanded && (
              <div style={{ padding: '20px 24px 24px', background: 'var(--bg-card-subtle)' }}>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Video size={14} color="var(--color-brand)" />
                  Creator Timeline & Stances for {stock.ticker}:
                </div>

                {/* Vertical Timeline Track Container */}
                <div style={{
                  position: 'relative',
                  paddingLeft: '28px',
                  borderLeft: '2px solid rgba(99, 102, 241, 0.3)',
                  marginLeft: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {stock.calls.map((call, idx) => {
                    const sentStyle = SENTIMENT_COLORS[call.sentiment] || SENTIMENT_COLORS.BUY;
                    const formattedDate = call.published_at
                      ? new Date(call.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : (call.created_at ? new Date(call.created_at).toLocaleDateString() : 'Recent');

                    return (
                      <div
                        key={call.id || idx}
                        style={{
                          position: 'relative',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '14px',
                          padding: '18px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: 'var(--shadow-card)'
                        }}
                      >
                        {/* Glowing Timeline Dot */}
                        <div style={{
                          position: 'absolute',
                          left: '-35px',
                          top: '24px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: sentStyle.bar,
                          border: '2px solid var(--bg-card)',
                          boxShadow: `0 0 8px ${sentStyle.bar}`
                        }} />

                        {/* Top Bar: Creator, Date, Sentiment & Ticker Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: 'var(--color-brand)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.85rem',
                              fontWeight: '900'
                            }}>
                              {call.channel_name ? call.channel_name[0].toUpperCase() : 'Y'}
                            </div>
                            <div>
                              <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                {call.channel_name}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                                📅 Covered on {formattedDate}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Stock Ticker Pill */}
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: 'rgba(99, 102, 241, 0.12)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              color: 'var(--color-brand)',
                              fontSize: '0.8rem',
                              fontWeight: '900',
                              letterSpacing: '0.04em'
                            }}>
                              {call.ticker || stock.ticker}
                            </span>

                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: sentStyle.bg,
                              border: `1px solid ${sentStyle.border}`,
                              color: sentStyle.text,
                              fontSize: '0.75rem',
                              fontWeight: '900'
                            }}>
                              {sentStyle.label}
                            </span>
                            {call.strategy_type && (
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'var(--bg-card-subtle)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.7rem',
                                fontWeight: '700'
                              }}>
                                {call.strategy_type.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Video Title */}
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0' }}>
                          "{call.video_title}"
                        </p>

                        {/* Key Levels Box */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '10px',
                          background: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-subtle)',
                          padding: '12px 16px',
                          borderRadius: '10px'
                        }}>
                          {call.buy_entry_zone && (
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Entry / Buy Zone</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-buy)' }}>
                                {call.buy_entry_zone}
                              </span>
                            </div>
                          )}
                          {call.target_price && (
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Target Price</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-accumulate)' }}>
                                {call.target_price}
                              </span>
                            </div>
                          )}
                          {call.stop_loss && (
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Stop Loss</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-sell)' }}>
                                {call.stop_loss}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Quote excerpt */}
                        {call.quote_excerpt && (
                          <div style={{
                            borderLeft: '3px solid var(--color-brand)',
                            paddingLeft: '12px',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.45',
                            fontStyle: 'italic'
                          }}>
                            "{call.quote_excerpt}"
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
                          <button
                            onClick={() => onSelectStock && onSelectStock(call)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-brand)',
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
                                background: 'var(--color-sell-bg)',
                                border: '1px solid var(--color-sell-border)',
                                color: 'var(--color-sell)',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                textDecoration: 'none'
                              }}
                            >
                              <ExternalLink size={13} /> Watch Video Segment
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
