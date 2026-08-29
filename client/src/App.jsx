import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsOverview from './components/StatsOverview';
import FilterBar from './components/FilterBar';
import StockCard from './components/StockCard';
import StockDetailModal from './components/StockDetailModal';
import ChannelManager from './components/ChannelManager';
import ScanModal from './components/ScanModal';
import {
  fetchRecommendations,
  fetchStats,
  fetchChannels,
  fetchScanStatus,
  triggerScanAll,
  clearScanQueue
} from './api';
import { RefreshCw, Radio, Search } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('stocks'); // 'stocks' | 'channels'
  
  // Data state
  const [recommendations, setRecommendations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [channels, setChannels] = useState([]);
  const [scanStatus, setScanStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState('ALL');
  const [channel, setChannel] = useState('ALL');
  
  // Modals
  const [selectedStock, setSelectedStock] = useState(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [recsData, statsData, channelsData] = await Promise.all([
        fetchRecommendations({ search, sentiment, channel, limit: 100 }),
        fetchStats(),
        fetchChannels()
      ]);
      setRecommendations(recsData.items || []);
      setTotalCount(recsData.total || 0);
      setStats(statsData);
      setChannels(channelsData || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [search, sentiment, channel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll scan status every 3 seconds if active
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await fetchScanStatus();
        setScanStatus(status);
        if (status.is_scanning) {
          // If scan completed, reload data
          loadData();
        }
      } catch (err) {
        // Ignore background poll errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleTriggerScanAll = async (limit = 2) => {
    try {
      await triggerScanAll(limit);
      alert('Batch scan started for all enabled channels!');
      const status = await fetchScanStatus();
      setScanStatus(status);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        isScanning={scanStatus?.is_scanning}
      />

      {/* Sequential 1-at-a-time Scan Queue Progress Banner */}
      {scanStatus?.is_scanning && (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(99, 102, 241, 0.3)', padding: '12px 24px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '280px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 10px #6366f1' }} className="animate-pulse" />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#ffffff' }}>
                    Sequential Worker Active (1-at-a-Time)
                  </span>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
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
              <div style={{ width: '100%', maxWidth: '240px', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${scanStatus.progress_percent || 5}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #10b981)', transition: 'width 0.3s ease' }} />
              </div>
              <button
                onClick={async () => {
                  await clearScanQueue();
                  const s = await fetchScanStatus();
                  setScanStatus(s);
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
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
      <main style={{ flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '24px' }}>
        {/* Scanning Banner if active */}
        {scanStatus?.is_scanning && (
          <div
            className="glass-panel animate-fade-in"
            style={{
              padding: '14px 20px',
              marginBottom: '20px',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              background: 'rgba(99, 102, 241, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={18} className="animate-spin" color="#818cf8" />
              <div>
                <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>AI Extraction in Progress:</strong>{' '}
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                  {scanStatus.progress_message}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Extracting buy levels with Gemini 3.7...
            </span>
          </div>
        )}

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
              channelsList={channels}
              totalResults={totalCount}
            />

            {/* Recommendations Grid */}
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <p>Loading real-time stock recommendations...</p>
              </div>
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
                <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '6px' }}>
                  No stock recommendations matched your filters
                </h3>
                <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto 16px' }}>
                  Try resetting the search or sentiment filters, or trigger a new scan on your subscribed channels.
                </p>
                <button
                  onClick={() => { setSearch(''); setSentiment('ALL'); setChannel('ALL'); }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '20px'
              }}>
                {recommendations.map(rec => (
                  <StockCard
                    key={rec.id}
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
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '20px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        background: 'rgba(7, 9, 14, 0.9)'
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
