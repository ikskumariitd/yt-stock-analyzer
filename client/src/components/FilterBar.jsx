import React from 'react';
import { Search, Filter, X, Calendar, ArrowUpDown } from 'lucide-react';

const SENTIMENT_OPTIONS = [
  { id: 'ALL', label: 'All Stances' },
  { id: 'BUY', label: '🟢 Buy' },
  { id: 'ACCUMULATE', label: '🔵 Accumulate' },
  { id: 'WATCHLIST', label: '🟡 Watchlist' },
  { id: 'SELL', label: '🔴 Sell / Avoid' },
];

const DATE_OPTIONS = [
  { id: '30', label: '⏱️ 30 Days (1 Mo)' },
  { id: '7', label: '7 Days' },
  { id: '90', label: '90 Days (3 Mo)' },
  { id: 'ALL', label: 'All Time' },
];

const SORT_OPTIONS = [
  { id: 'mentions', label: '👥 Most Recommended' },
  { id: 'date', label: '📅 Newest Video Date' },
  { id: 'bullish', label: '🚀 Highest Bullish Bias' },
  { id: 'ticker', label: '🔤 Ticker A-Z' },
];

export default function FilterBar({
  search,
  setSearch,
  sentiment,
  setSentiment,
  channel,
  setChannel,
  days = '30',
  setDays,
  sortBy = 'mentions',
  setSortBy,
  channelsList,
  totalResults,
  viewMode = 'consensus',
  setViewMode
}) {
  return (
    <div className="glass-panel" style={{ padding: '18px 20px', marginBottom: '24px' }}>
      {/* Row 1: Search, View Mode, Quick Stats */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        marginBottom: '14px'
      }}>
        {/* Search Bar */}
        <div style={{
          position: 'relative',
          flex: '1 1 260px',
          minWidth: '220px'
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
            placeholder="Search Ticker (IREN, NVDA), Company, Catalyst..."
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

        {/* View Switcher: Individual vs Consensus Clubbed */}
        <div style={{
          display: 'flex',
          background: 'rgba(2, 6, 23, 0.8)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '3px',
          gap: '2px'
        }}>
          <button
            onClick={() => setViewMode && setViewMode('consensus')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'consensus' ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(16, 185, 129, 0.4))' : 'transparent',
              color: viewMode === 'consensus' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            🏛️ Consensus (Clubbed)
          </button>
          <button
            onClick={() => setViewMode && setViewMode('individual')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'individual' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
              color: viewMode === 'individual' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            🎴 Newest Feed
          </button>
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

          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {totalResults} {viewMode === 'consensus' ? 'stocks' : 'calls'}
          </span>
        </div>
      </div>

      {/* Row 2: Date Filter, Sort By, Sentiment Pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        {/* Date Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Calendar size={13} color="#818cf8" /> Timeframe:
          </span>
          {DATE_OPTIONS.map(dOpt => {
            const isSelected = days === dOpt.id;
            return (
              <button
                key={dOpt.id}
                onClick={() => setDays && setDays(dOpt.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? '800' : '600',
                  border: isSelected ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? '#34d399' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {dOpt.label}
              </button>
            );
          })}
        </div>

        {/* Sort By Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpDown size={13} color="#818cf8" /> Sort:
          </span>
          <select
            value={sortBy}
            onChange={e => setSortBy && setSortBy(e.target.value)}
            style={{
              padding: '6px 10px',
              background: 'rgba(2, 6, 23, 0.85)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: '700',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {SORT_OPTIONS.map(sOpt => (
              <option key={sOpt.id} value={sOpt.id}>
                {sOpt.label}
              </option>
            ))}
          </select>
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
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
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
      </div>
    </div>
  );
}
