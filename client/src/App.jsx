import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsOverview from './components/StatsOverview';
import FilterBar from './components/FilterBar';
import StockCard from './components/StockCard';
import StockDetailModal from './components/StockDetailModal';
import ChannelManager from './components/ChannelManager';
import ScanModal from './components/ScanModal';
import ConsensusView from './components/ConsensusView';
import ScanAuditLog from './components/ScanAuditLog';
import {
  fetchRecommendations,
  fetchConsensus,
  fetchStats,
  fetchChannels,
  fetchScanStatus,
  triggerScanAll,
  clearScanQueue
} from './api';
import { RefreshCw, Radio, Search } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('stocks'); // 'stocks' | 'channels'
  const [viewMode, setViewMode] = useState('consensus'); // 'consensus' (default clubbed) | 'individual'
  
  // Theme state: Light Theme default
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('alphapulse_theme') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('alphapulse_theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    }
  }, [theme]);

  // Data state
  const [recommendations, setRecommendations] = useState([]);
  const [consensusData, setConsensusData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [channels, setChannels] = useState([]);
  const [scanStatus, setScanStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState('ALL');
  const [channel, setChannel] = useState('ALL');
  const [days, setDays] = useState('30'); // Default 1 month (30 days)
  const [stanceChange, setStanceChange] = useState('ALL'); // 'ALL' | 'CHANGES_ONLY' | 'UPGRADED' | 'DOWNGRADED' | 'REITERATED'
  const [sortBy, setSortBy] = useState('mentions'); // Default most recommended first
  
  // Modals
  const [selectedStock, setSelectedStock] = useState(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  // Load Data (with optional silent background refresh)
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [recsData, consensusList, statsData, channelsData] = await Promise.all([
        fetchRecommendations({ search, sentiment, channel, days, stanceChange, limit: 100 }),
        fetchConsensus({ search, sentiment, channel, days, stanceChange, sortBy }),
        fetchStats(),
        fetchChannels()
      ]);
      setRecommendations(recsData.items || []);
      setConsensusData(consensusList || []);
      setTotalCount(viewMode === 'consensus' ? (consensusList?.length || 0) : (recsData.total || 0));
      setStats(statsData);
      setChannels(channelsData || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [search, sentiment, channel, days, stanceChange, sortBy, viewMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initial check on mount
  useEffect(() => {
    fetchScanStatus()
      .then(status => setScanStatus(status))
      .catch(() => {});
  }, []);

  // Poll status ONLY when a scan is actively running, stop completely when idle
  useEffect(() => {
    if (!scanStatus?.is_scanning) return;

    let lastCompleted = scanStatus?.completed_count || 0;

    const interval = setInterval(async () => {
      try {
        const status = await fetchScanStatus();
        setScanStatus(status);

        // Silent refresh when an item completes or when the entire queue finishes
        if (status.completed_count > lastCompleted || !status.is_scanning) {
          lastCompleted = status.completed_count;
          loadData(true);
        }
      } catch (err) {
        // Ignore background poll errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scanStatus?.is_scanning, loadData]);

  const handleTriggerScanAll = async (limit = 2, afterDate = '') => {
    try {
      const res = await triggerScanAll(limit, afterDate);
      alert(res.message || 'Batch scan started for all enabled channels!');
      // Immediately set is_scanning true to activate polling
      setScanStatus(prev => ({ ...prev, is_scanning: true }));
      const status = await fetchScanStatus();
      setScanStatus(status);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with Theme Switcher */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        isScanning={scanStatus?.is_scanning}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Sequential 1-at-a-time Scan Queue Progress Banner */}
      {scanStatus?.is_scanning && (
        <div style={{ background: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '12px 24px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '280px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-brand)', boxShadow: '0 0 10px var(--color-brand)' }} className="animate-pulse" />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Sequential Worker Active (1-at-a-Time)
                  </span>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-brand)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                    {scanStatus.completed_count} / {scanStatus.total_in_batch} Done ({scanStatus.progress_percent}%)
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '600px' }}>
                  {scanStatus.current_item ? `Analyzing: "${scanStatus.current_item.title}" (${scanStatus.current_item.channel_name})` : 'Preparing next video in queue...'}
                </p>
              </div>
            </div>

            {/* Progress Bar & Clear Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1', minWidth: '240px', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', maxWidth: '240px', height: '6px', background: 'var(--border-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${scanStatus.progress_percent || 5}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #10b981)', transition: 'width 0.3s ease' }} />
              </div>
              <button
                onClick={async () => {
                  await clearScanQueue();
                  const s = await fetchScanStatus();
                  setScanStatus(s);
                }}
                style={{
                  background: 'var(--color-sell-bg)',
                  border: '1px solid var(--color-sell-border)',
                  color: 'var(--color-sell)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Stop Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '100%', width: '100%', margin: '0 auto', padding: '20px 24px' }}>
        {/* Tab 1: Stock Radar */}
        {activeTab === 'stocks' && (
          <div>
            {/* Top Stats Overview */}
            <StatsOverview
              stats={stats}
              onSelectTicker={t => setSearch(t)}
            />

            {/* Filter Bar */}
            <FilterBar
              search={search}
              setSearch={setSearch}
              sentiment={sentiment}
              setSentiment={setSentiment}
              channel={channel}
              setChannel={setChannel}
              days={days}
              setDays={setDays}
              stanceChange={stanceChange}
              setStanceChange={setStanceChange}
              sortBy={sortBy}
              setSortBy={setSortBy}
              channelsList={channels}
              totalResults={totalCount}
              viewMode={viewMode}
              setViewMode={setViewMode}
            />

            {/* Recommendations or Consensus View */}
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-brand)' }} />
                <p>Loading real-time stock recommendations...</p>
              </div>
            ) : viewMode === 'consensus' ? (
              <ConsensusView
                consensusData={consensusData}
                onSelectStock={setSelectedStock}
              />
            ) : recommendations.length === 0 ? (
              <div
                className="glass-panel"
                style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}
              >
                <Search size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  No stock recommendations matched your filters
                </h3>
                <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto 16px', color: 'var(--text-secondary)' }}>
                  Try resetting the search or sentiment filters, or trigger a new scan on your subscribed channels.
                </p>
                <button
                  onClick={() => { setSearch(''); setSentiment('ALL'); setChannel('ALL'); setDays('30'); setSortBy('mentions'); }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: 'var(--color-brand)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '20px'
              }}>
                {recommendations.map((rec, idx) => (
                  <StockCard
                    key={rec.id || idx}
                    recommendation={rec}
                    onOpenDetail={setSelectedStock}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Channels Manager */}
        {activeTab === 'channels' && (
          <ChannelManager
            channels={channels}
            onRefresh={loadData}
            onTriggerScanAll={handleTriggerScanAll}
            isScanning={scanStatus?.is_scanning}
          />
        )}

        {/* Tab 3: Scan Audit & History */}
        {activeTab === 'audit' && (
          <ScanAuditLog
            onRescanTriggered={loadData}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '20px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        background: 'var(--header-bg)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span>AlphaPulse AI — Powered by Google Gemini 3.7</span>
          <span>FastAPI + SQLite + React + Vite</span>
        </div>
      </footer>

      {/* Stock Deep-Dive Modal */}
      {selectedStock && (
        <StockDetailModal
          recommendation={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}

      {/* Quick Scan Modal */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onScanTriggered={loadData}
        scanStatus={scanStatus}
      />
    </div>
  );
}
