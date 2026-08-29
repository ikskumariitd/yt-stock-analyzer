import React from 'react';
import { Search, Filter, X } from 'lucide-react';

const SENTIMENT_OPTIONS = [
  { id: 'ALL', label: 'All Stances' },
  { id: 'BUY', label: '🟢 Buy' },
  { id: 'ACCUMULATE', label: '🔵 Accumulate' },
  { id: 'WATCHLIST', label: '🟡 Watchlist' },
  { id: 'SELL', label: '🔴 Sell / Avoid' },
];

export default function FilterBar({
  search,
  setSearch,
  sentiment,
  setSentiment,
  channel,
  setChannel,
  channelsList,
  totalResults
}) {
  return (
    <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        {/* Search Bar */}
        <div style={{
          position: 'relative',
          flex: '1 1 300px',
          minWidth: '240px'
        }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input
            type="text"
            placeholder="Search by Ticker (e.g. IREN, NVDA), Company, or Keyword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 36px 10px 38px',
              background: 'rgba(2, 6, 23, 0.7)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
              fontFamily: 'var(--font-main)',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--color-brand)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Sentiment Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SENTIMENT_OPTIONS.map(opt => {
            const isSelected = sentiment === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSentiment(opt.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  border: isSelected ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Channel Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={channel}
            onChange={e => setChannel(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'rgba(2, 6, 23, 0.7)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Creators ({channelsList?.length || 0})</option>
            {(channelsList || []).map(ch => (
              <option key={ch.id || ch.name} value={ch.name}>
                {ch.name}
              </option>
            ))}
          </select>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {totalResults} {totalResults === 1 ? 'call' : 'calls'}
          </span>
        </div>
      </div>
    </div>
  );
}
