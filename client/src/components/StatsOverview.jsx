import React from 'react';
import { TrendingUp, Target, Tv, Flame } from 'lucide-react';

export default function StatsOverview({ stats, onSelectTicker }) {
  if (!stats) return null;

  const sentimentDist = stats.sentiment_distribution || {};
  const bullishCount = (sentimentDist.BUY || 0) + (sentimentDist.STRONG_BUY || 0) + (sentimentDist.ACCUMULATE || 0);
  const total = stats.total_recommendations || 0;
  const bullishPercent = total > 0 ? Math.round((bullishCount / total) * 100) : 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    }}>
      {/* Metric 1: Total Stock Calls */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.12)',
          color: 'var(--color-brand)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Target size={24} />
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Stock Calls
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {stats.total_recommendations || 0}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              across {stats.total_videos_analyzed || 0} videos
            </span>
          </div>
        </div>
      </div>

      {/* Metric 2: Bullish Stance % */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'var(--color-buy-bg)',
          color: 'var(--color-buy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <TrendingUp size={24} />
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Creator Bullish Bias
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-buy)' }}>
              {bullishPercent}%
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              ({bullishCount} Buy/Accumulate)
            </span>
          </div>
        </div>
      </div>

      {/* Metric 3: Active Channels Monitored */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'rgba(6, 182, 212, 0.12)',
          color: 'var(--color-accumulate)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Tv size={24} />
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Monitored Creators
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {stats.active_channels || 0}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Active Subscriptions
            </span>
          </div>
        </div>
      </div>

      {/* Metric 4: Trending Tickers */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Flame size={16} color="#f59e0b" />
          <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Trending Mentions
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(stats.top_tickers || []).slice(0, 5).map(t => (
            <button
              key={t.ticker}
              onClick={() => onSelectTicker && onSelectTicker(t.ticker)}
              style={{
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'var(--color-brand)';
                e.currentTarget.style.borderColor = 'var(--color-brand)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'var(--bg-card-subtle)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
            >
              {t.ticker}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
