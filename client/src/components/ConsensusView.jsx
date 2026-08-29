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
  Video
} from 'lucide-react';

const SENTIMENT_COLORS = {
  STRONG_BUY: { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 0.5)', text: '#34d399', label: 'STRONG BUY', bar: '#10b981' },
  BUY: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399', label: 'BUY', bar: '#10b981' },
  ACCUMULATE: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa', label: 'ACCUMULATE', bar: '#3b82f6' },
  WATCHLIST: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)', text: '#facc15', label: 'WATCHLIST', bar: '#eab308' },
  HOLD: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)', text: '#facc15', label: 'HOLD', bar: '#eab308' },
  SELL: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#f87171', label: 'SELL', bar: '#ef4444' },
  AVOID: { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.5)', text: '#f87171', label: 'AVOID', bar: '#ef4444' }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px', marginTop: '12px' }}>
      {consensusData.map((stock, sIdx) => {
        const isExpanded = expandedTickers[stock.ticker] !== false; // Default expanded
        const domSentStyle = SENTIMENT_COLORS[stock.dominant_sentiment] || SENTIMENT_COLORS.BUY;

        return (
          <div
            key={stock.ticker}
            className="animate-fade-in"
            style={{
              position: 'relative',
              borderRadius: '18px',
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 23, 0.85) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1)',
              overflow: 'hidden'
            }}
          >
            {/* Top Accent Gradient Bar - Clear Visual Boundary for Each Stock */}
            <div style={{
              height: '4px',
              width: '100%',
              background: `linear-gradient(90deg, #6366f1 0%, ${domSentStyle.bar} 45%, transparent 100%)`
            }} />

            {/* Main Stock Header */}
            <div
              onClick={() => toggleExpand(stock.ticker)}
              style={{
                padding: '24px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                cursor: 'pointer',
                userSelect: 'none',
                background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                transition: 'background 0.2s ease'
              }}
            >
              {/* Left: Ticker, Name, Consensus */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  padding: '10px 18px',
                  background: 'rgba(99, 102, 241, 0.25)',
                  border: '1px solid rgba(99, 102, 241, 0.5)',
                  borderRadius: '12px',
                  fontWeight: '900',
                  fontSize: '1.5rem',
                  color: '#ffffff',
                  letterSpacing: '0.05em',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.2)'
                }}>
                  {stock.ticker}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.01em' }}>
                      {stock.company_name}
                    </h3>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      background: domSentStyle.bg,
                      border: `1px solid ${domSentStyle.border}`,
                      color: domSentStyle.text,
                      fontSize: '0.8rem',
                      fontWeight: '900',
                      letterSpacing: '0.05em'
                    }}>
                      CONSENSUS: {domSentStyle.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#a5b4fc', fontWeight: '700' }}>
                      <Users size={15} /> {stock.total_calls} {stock.total_calls === 1 ? 'Review' : 'Reviews'} across {stock.unique_creators} {stock.unique_creators === 1 ? 'Creator' : 'Creators'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={14} /> Latest: {stock.latest_date ? new Date(stock.latest_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Targets & Collapse Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {stock.targets.length > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Target Targets</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--color-buy)' }}>
                      {stock.targets.slice(0, 2).join(' / ')}
                    </span>
                  </div>
                )}

                <button
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '700'
                  }}
                >
                  {isExpanded ? (
                    <>Hide Breakdown <ChevronUp size={16} /></>
                  ) : (
                    <>View Breakdown ({stock.total_calls}) <ChevronDown size={16} /></>
                  )}
                </button>
              </div>
            </div>

            {/* Expanded List of Creator Reviews with Connected Left Timeline Rail */}
            {isExpanded && (
              <div style={{ padding: '24px 28px' }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Video size={14} color="#818cf8" />
                  Creator Timeline & Breakdown for {stock.ticker}:
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
                          background: 'rgba(30, 41, 59, 0.45)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '14px',
                          padding: '18px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
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
                          border: '2px solid #020617',
                          boxShadow: `0 0 8px ${sentStyle.bar}`
                        }} />

                        {/* Top Bar: Creator, Date, Sentiment Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: 'rgba(99, 102, 241, 0.25)',
                              color: '#a5b4fc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.85rem',
                              fontWeight: '900'
                            }}>
                              {call.channel_name ? call.channel_name[0].toUpperCase() : 'Y'}
                            </div>
                            <div>
                              <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#ffffff' }}>
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
                              background: 'rgba(99, 102, 241, 0.25)',
                              border: '1px solid rgba(99, 102, 241, 0.5)',
                              color: '#ffffff',
                              fontSize: '0.8rem',
                              fontWeight: '900',
                              letterSpacing: '0.04em',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
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
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
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
                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', fontStyle: 'italic', margin: '0' }}>
                          "{call.video_title}"
                        </p>

                        {/* Key Levels Box */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '10px',
                          background: 'rgba(2, 6, 23, 0.7)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
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
                              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-accent)' }}>
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
                            borderLeft: '3px solid rgba(99, 102, 241, 0.6)',
                            paddingLeft: '12px',
                            fontSize: '0.8rem',
                            color: '#94a3b8',
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
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                color: '#f87171',
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
