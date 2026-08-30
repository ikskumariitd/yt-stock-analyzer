import React from 'react';
import { Search, Filter, X, Calendar, ArrowUpDown } from 'lucide-react';

const SENTIMENT_OPTIONS = [
  { id: 'ALL', label: 'All Stances' },
  { id: 'STRONG_BUY', label: '🚀 Strong Buy' },
  { id: 'BUY', label: '🟢 Buy' },
  { id: 'ACCUMULATE', label: '🔵 Accumulate' },
  { id: 'WATCHLIST', label: '🟡 Watchlist' },
  { id: 'SELL', label: '🔴 Sell / Avoid' },
];

const DATE_OPTIONS = [
  { id: '30', label: '⏱️ 30 Days (1 Mo)' },
  { id: '7', label: '7 Days' },
  { id: '90', label: '90 Days (3 Mo)' },
  { id: 'YTD', label: 'YTD' },
  { id: '365', label: '1 Year' },
  { id: 'ALL', label: 'Max (All Time)' },
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
            placeholder="Search Ticker (IREN, NVDA, APP), Company, Catalyst..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 36px 10px 38px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              fontFamily: 'var(--font-main)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--color-brand)';
              e.target.style.boxShadow = '0 0 0 3px var(--border-glow)';
            }}
            onBlur={e => {
              e.target.style.borderColor = 'var(--border-subtle)';
              e.target.style.boxShadow = 'none';
            }}
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
          background: 'var(--nav-bg)',
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
              background: viewMode === 'consensus' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'consensus' ? 'var(--color-brand)' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: viewMode === 'consensus' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
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
              background: viewMode === 'individual' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'individual' ? 'var(--color-brand)' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: viewMode === 'individual' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
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
              background: 'var(--bg-input)',
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
        borderTop: '1px solid var(--border-subtle)'
      }}>
        {/* Date Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Calendar size={13} color="var(--color-brand)" /> Timeframe:
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
                  border: isSelected ? '1px solid var(--color-buy)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--color-buy-bg)' : 'var(--bg-card-subtle)',
                  color: isSelected ? 'var(--color-buy)' : 'var(--text-secondary)',
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
            <ArrowUpDown size={13} color="var(--color-brand)" /> Sort:
          </span>
          <select
            value={sortBy}
            onChange={e => setSortBy && setSortBy(e.target.value)}
            style={{
              padding: '6px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
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
                  border: isSelected ? '1px solid var(--color-brand)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card-subtle)',
                  color: isSelected ? 'var(--color-brand)' : 'var(--text-secondary)',
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
