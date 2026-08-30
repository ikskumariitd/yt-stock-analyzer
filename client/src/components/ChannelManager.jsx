import React, { useState, useEffect } from 'react';
import {
  Tv,
  Plus,
  Play,
  Check,
  ExternalLink,
  RefreshCw,
  Radio,
  Link2,
  Sparkles,
  Trash2,
  Calendar,
  X,
  Clock,
  ArrowUp,
  ArrowDown,
  Bot,
  SlidersHorizontal,
  Zap,
  Brain,
  ChevronDown,
  ChevronUp,
  Film
} from 'lucide-react';
import {
  addChannel,
  toggleChannel,
  deleteChannel,
  triggerScan,
  triggerScanAll,
  fetchYoutubeAuthStatus,
  syncLiveYoutubeSubscriptions,
  fetchChannelVideos
} from '../api';
import { formatSingaporeDateTime, formatSingaporeDate } from '../utils/timeUtils';

export default function ChannelManager({ channels = [], onRefresh, onTriggerScanAll, isScanning }) {
  const [newHandle, setNewHandle] = useState('');
  const [newName, setNewName] = useState('');
  const [scanLimit, setScanLimit] = useState(2);
  const [scanAfterDate, setScanAfterDate] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(3600); // 60 mins default
  const [expandedChannelId, setExpandedChannelId] = useState(null);
  const [channelVideos, setChannelVideos] = useState({});
  const [loadingVideos, setLoadingVideos] = useState({});
  const [modelCascade, setModelCascade] = useState([
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.7-flash'
  ]);
  const [availableModels, setAvailableModels] = useState([
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-2.5-pro'
  ]);
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [modelSaveMsg, setModelSaveMsg] = useState('');
  const [channelLimits, setChannelLimits] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch YouTube OAuth live status and scan settings
  useEffect(() => {
    fetchYoutubeAuthStatus()
      .then(data => setAuthStatus(data))
      .catch(() => setAuthStatus(null));

    fetch('/api/scan/settings')
      .then(r => r.json())
      .then(data => {
        if (data?.cooldown_seconds !== undefined) {
          setCooldownSeconds(data.cooldown_seconds);
        }
        if (Array.isArray(data?.model_cascade) && data.model_cascade.length > 0) {
          setModelCascade(data.model_cascade);
        }
        if (Array.isArray(data?.available_models)) {
          setAvailableModels(data.available_models);
        }
      })
      .catch(() => {});
  }, []);

  const handleCooldownChange = async (newVal) => {
    const val = Number(newVal);
    setCooldownSeconds(val);
    try {
      await fetch('/api/scan/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cooldown_seconds: val })
      });
    } catch (e) {
      console.error("Failed to update cooldown setting", e);
    }
  };

  const saveModelCascade = async (newCascade) => {
    setModelCascade(newCascade);
    try {
      await fetch('/api/scan/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_cascade: newCascade })
      });
      setModelSaveMsg('✓ Saved & Persisted in DB');
      setTimeout(() => setModelSaveMsg(''), 2500);
    } catch (e) {
      console.error("Failed to save model cascade", e);
    }
  };

  const moveModelUp = (index) => {
    if (index === 0) return;
    const updated = [...modelCascade];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    saveModelCascade(updated);
  };

  const moveModelDown = (index) => {
    if (index === modelCascade.length - 1) return;
    const updated = [...modelCascade];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    saveModelCascade(updated);
  };

  const removeModel = (modelToRemove) => {
    if (modelCascade.length <= 1) {
      alert("At least one model must remain in the cascade.");
      return;
    }
    const updated = modelCascade.filter(m => m !== modelToRemove);
    saveModelCascade(updated);
  };

  const addModel = (modelToAdd) => {
    if (modelCascade.includes(modelToAdd)) return;
    const updated = [...modelCascade, modelToAdd];
    saveModelCascade(updated);
  };

  const applyPreset = (preset) => {
    let presetList = [];
    if (preset === 'speed') {
      presetList = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-flash-lite-latest'];
    } else if (preset === 'accuracy') {
      presetList = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
    } else if (preset === 'balanced') {
      presetList = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-flash-lite-latest'];
    }
    saveModelCascade(presetList);
  };

  const handleLiveSync = async () => {
    if (!authStatus?.connected) {
      window.location.href = '/api/auth/youtube/login';
      return;
    }

    setIsSyncing(true);
    try {
      const res = await syncLiveYoutubeSubscriptions();
      alert(res.message || 'Synced successfully!');
      onRefresh();
    } catch (err) {
      if (err.message && (err.message.includes('401') || err.message.includes('connect'))) {
        window.location.href = '/api/auth/youtube/login';
      } else {
        alert(err.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newHandle.trim()) return;

    try {
      setIsSubmitting(true);
      await addChannel(newHandle.trim(), newName.trim() || undefined);
      setNewHandle('');
      setNewName('');
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await toggleChannel(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from monitored channels?`)) return;
    try {
      await deleteChannel(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleScanSingle = async (ch) => {
    const limit = channelLimits[ch.id] || 2;
    try {
      await triggerScan(ch.url, limit, scanAfterDate);
      const dateMsg = scanAfterDate ? ` published after ${scanAfterDate}` : '';
      alert(`Enqueued up to ${limit} videos${dateMsg} from "${ch.name}" for sequential scan (already analyzed videos will skip automatically)!`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleVideos = async (channelId) => {
    if (expandedChannelId === channelId) {
      setExpandedChannelId(null);
      return;
    }

    setExpandedChannelId(channelId);
    if (!channelVideos[channelId]) {
      setLoadingVideos(prev => ({ ...prev, [channelId]: true }));
      try {
        const data = await fetchChannelVideos(channelId);
        setChannelVideos(prev => ({ ...prev, [channelId]: data.videos || [] }));
      } catch (err) {
        console.error('Failed to fetch videos for creator:', err);
      } finally {
        setLoadingVideos(prev => ({ ...prev, [channelId]: false }));
      }
    }
  };

  // Quick preset helper
  const setQuickDateOffset = (type) => {
    if (type === 0 || type === 'ALL' || type === 'MAX') {
      setScanAfterDate('');
      return;
    }
    if (type === 'YTD') {
      const startOfYear = `${new Date().getFullYear()}-01-01`;
      setScanAfterDate(startOfYear);
      return;
    }
    if (type === '1Y' || type === 365) {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      setScanAfterDate(d.toISOString().slice(0, 10));
      return;
    }
    const daysAgo = Number(type);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setScanAfterDate(d.toISOString().slice(0, 10));
  };

  return (
    <div style={{ width: '100%', margin: '0 auto' }}>
      {/* Top Banner: Monitored Channels + Scan All Actions */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.12)',
                color: 'var(--color-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Tv size={20} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                Monitored YouTube Creators
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
              The AI watcher scans these channels automatically to ingest new stock picks and key price levels.
            </p>
          </div>

          {/* Live YouTube Account Sync Button */}
          <button
            onClick={handleLiveSync}
            disabled={isSyncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: authStatus?.connected
                ? 'var(--color-buy-bg)'
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: authStatus?.connected ? '1px solid var(--color-buy-border)' : 'none',
              color: authStatus?.connected ? 'var(--color-buy)' : '#ffffff',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.8rem',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              boxShadow: authStatus?.connected ? 'none' : '0 4px 14px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            {isSyncing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : authStatus?.connected ? (
              <Check size={14} />
            ) : (
              <Link2 size={14} />
            )}
            {isSyncing
              ? 'Syncing with YouTube...'
              : authStatus?.connected
              ? '✓ Live Synced with YouTube'
              : '🔗 Connect YouTube Account'}
          </button>
        </div>

        {/* Scan All Controls Bar: Date Picker + Depth + Action Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          padding: '14px 18px',
          background: 'var(--bg-card-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px'
        }}>
          {/* Published After Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="var(--color-brand)" />
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Scan Videos After Date:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={scanAfterDate}
                onChange={e => setScanAfterDate(e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              {scanAfterDate && (
                <button
                  onClick={() => setScanAfterDate('')}
                  title="Clear Date Filter"
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Date Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setQuickDateOffset(1)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                24h
              </button>
              <button
                type="button"
                onClick={() => setQuickDateOffset(7)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickDateOffset(30)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickDateOffset('YTD')}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                YTD
              </button>
              <button
                type="button"
                onClick={() => setQuickDateOffset('1Y')}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                1 Y
              </button>
              <button
                type="button"
                onClick={() => setQuickDateOffset('ALL')}
                style={{
                  background: !scanAfterDate ? 'var(--color-buy-bg)' : 'var(--bg-input)',
                  border: !scanAfterDate ? '1px solid var(--color-buy)' : '1px solid var(--border-subtle)',
                  color: !scanAfterDate ? 'var(--color-buy)' : 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                Max (All)
              </button>
            </div>
          </div>

          {/* Depth, Cooling Period & Scan Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Cooling Period Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} color="var(--color-brand)" /> Cooldown:
              </span>
              <select
                value={cooldownSeconds}
                onChange={e => handleCooldownChange(e.target.value)}
                title="Cooling period between each scanned video to prevent rate limits"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10s (Fast)</option>
                <option value={30}>30s (Gentle)</option>
                <option value={60}>1 Min</option>
                <option value={300}>5 Mins</option>
                <option value={900}>15 Mins</option>
                <option value={1800}>30 Mins</option>
                <option value={3600}>60 Mins (1 Hour)</option>
                <option value={7200}>2 Hours</option>
              </select>
            </div>

            {/* Depth Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Depth:</span>
              <select
                value={scanLimit}
                onChange={e => setScanLimit(Number(e.target.value))}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={1}>Latest 1 Video</option>
                <option value={2}>Latest 2 Videos</option>
                <option value={3}>Latest 3 Videos</option>
                <option value={5}>Latest 5 Videos</option>
                <option value={10}>Latest 10 Videos</option>
                <option value={25}>Latest 25 Videos</option>
                <option value={50}>Max Available (50)</option>
              </select>
            </div>

            {/* AI Model Cascade Priority Button */}
            <button
              type="button"
              onClick={() => setShowModelConfig(!showModelConfig)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: showModelConfig ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-input)',
                border: showModelConfig ? '1px solid var(--color-brand)' : '1px solid var(--border-subtle)',
                color: showModelConfig ? 'var(--color-brand)' : 'var(--text-primary)',
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Configure Gemini Model Priority & Cascade Order"
            >
              <Bot size={14} color="var(--color-brand)" />
              AI Models ({modelCascade.length})
              <SlidersHorizontal size={12} />
            </button>

            <button
              onClick={() => onTriggerScanAll(scanLimit, scanAfterDate)}
              disabled={isScanning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: isScanning ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)',
                opacity: isScanning ? 0.7 : 1
              }}
            >
              <RefreshCw size={15} className={isScanning ? 'animate-spin' : ''} />
              {isScanning ? 'Scanning All...' : 'Scan All Channels'}
            </button>
          </div>
        </div>

        {/* Model Cascade Configuration Drawer */}
        {showModelConfig && (
          <div style={{
            marginTop: '20px',
            padding: '18px 20px',
            background: 'var(--bg-card-subtle)',
            borderRadius: '12px',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={16} color="var(--color-brand)" />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Gemini AI Model Priority & Fallback Cascade
                  </h4>
                  {modelSaveMsg && (
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                      {modelSaveMsg}
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Scans try models from Top to Bottom (Priority 1 $\rightarrow$ 2 $\rightarrow$ 3). Reorder using ▲ / ▼ arrows or pick a preset. Persisted in SQLite.
                </p>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('speed')}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Zap size={11} color="#f59e0b" /> Speed First (3.5 Lite)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('accuracy')}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Brain size={11} color="#6366f1" /> State-of-the-Art (3.7 Flash)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('balanced')}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={11} color="#10b981" /> Balanced (3.6 Flash)
                </button>
              </div>
            </div>

            {/* Model Ordering List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {modelCascade.map((mName, idx) => (
                <div
                  key={mName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    background: 'var(--bg-card)',
                    border: idx === 0 ? '1px solid var(--color-brand)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: idx === 0 ? 'var(--color-brand)' : 'var(--bg-input)',
                      color: idx === 0 ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {idx + 1}
                    </span>
                    <div>
                      <span style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {mName}
                      </span>
                      {idx === 0 && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: 'var(--color-brand)'
                        }}>
                          ⚡ Primary Choice
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => moveModelUp(idx)}
                      disabled={idx === 0}
                      title="Move model priority up"
                      style={{
                        padding: '4px 6px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: idx === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveModelDown(idx)}
                      disabled={idx === modelCascade.length - 1}
                      title="Move model priority down"
                      style={{
                        padding: '4px 6px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: idx === modelCascade.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: idx === modelCascade.length - 1 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeModel(mName)}
                      title="Remove from cascade"
                      style={{
                        padding: '4px 6px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '4px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Available Models */}
            {availableModels.some(m => !modelCascade.includes(m)) && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>Add Model:</span>
                {availableModels.filter(m => !modelCascade.includes(m)).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => addModel(m)}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px dashed var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={11} /> {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Channel Form */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
          + Add New Creator (YouTube or Instagram)
        </h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <input
            type="text"
            placeholder="YouTube (@MeetKevin) or Instagram (@creator / instagram.com/creator)"
            value={newHandle}
            onChange={e => setNewHandle(e.target.value)}
            required
            style={{
              flex: '2 1 240px',
              padding: '10px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Optional Display Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{
              flex: '1 1 180px',
              padding: '10px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              background: 'var(--color-brand)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} /> Add Creator
          </button>
        </form>
      </div>

      {/* Channels List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(channels || []).map(ch => {
          const isInstagram = ch.platform === 'instagram' || (ch.url && ch.url.includes('instagram.com'));
          return (
          <div
            key={ch.id || ch.url}
            className="glass-panel"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: ch.enabled 
                  ? (isInstagram ? 'rgba(236, 72, 153, 0.15)' : 'var(--color-buy-bg)')
                  : 'var(--bg-card-subtle)',
                color: ch.enabled 
                  ? (isInstagram ? '#ec4899' : 'var(--color-buy)')
                  : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '1.1rem'
              }}>
                {isInstagram ? '📷' : (ch.name ? ch.name[0].toUpperCase() : 'Y')}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                    {ch.name}
                  </h4>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isInstagram ? 'rgba(236, 72, 153, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                    color: isInstagram ? '#ec4899' : '#ef4444',
                    border: isInstagram ? '1px solid rgba(236, 72, 153, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    {isInstagram ? 'Instagram' : 'YouTube'}
                  </span>
                  <a
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {ch.handle || ch.url} <ExternalLink size={10} />
                  </a>
                </div>

                {/* Tracked Videos & Picks Stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleVideos(ch.id)}
                    title="Click to view all tracked videos for this creator in descending order of upload date"
                    style={{
                      fontSize: '0.75rem',
                      background: expandedChannelId === ch.id ? 'var(--color-brand)' : 'rgba(99, 102, 241, 0.1)',
                      border: expandedChannelId === ch.id ? '1px solid var(--color-brand)' : '1px solid rgba(99, 102, 241, 0.25)',
                      color: expandedChannelId === ch.id ? '#ffffff' : 'var(--color-brand)',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Film size={12} />
                    {ch.analyzed_videos_count || 0} Videos Tracked
                    {expandedChannelId === ch.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  <span style={{
                    fontSize: '0.75rem',
                    background: 'var(--color-buy-bg)',
                    border: '1px solid var(--color-buy-border)',
                    color: 'var(--color-buy)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: '700'
                  }}>
                    📈 {ch.stock_picks_count || 0} Stock Calls
                  </span>
                  {ch.last_scanned_at && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • Last scanned: {formatSingaporeDateTime(ch.last_scanned_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--bg-card-subtle)',
              padding: '6px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)'
            }}>
              {/* Per-Channel Video Limit Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Fetch:</span>
                <select
                  value={channelLimits[ch.id] || 2}
                  onChange={e => setChannelLimits(prev => ({ ...prev, [ch.id]: parseInt(e.target.value) }))}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  title="Number of recent videos to check (duplicates will be skipped)"
                >
                  <option value={1}>1 Video</option>
                  <option value={2}>2 Videos</option>
                  <option value={3}>3 Videos</option>
                  <option value={5}>5 Videos</option>
                  <option value={10}>10 Videos</option>
                  <option value={15}>15 Videos</option>
                </select>
              </div>

              {/* Scan Button */}
              <button
                onClick={() => handleScanSingle(ch)}
                title="Scan channel (Skips already analyzed videos automatically)"
                style={{
                  background: 'var(--color-brand)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px var(--color-brand-glow)'
                }}
              >
                <Play size={12} fill="#ffffff" /> Scan Channel
              </button>

              {/* Toggle Enable/Disable */}
              <button
                onClick={() => handleToggle(ch.id)}
                style={{
                  background: ch.enabled ? 'var(--color-buy-bg)' : 'var(--color-sell-bg)',
                  border: ch.enabled ? '1px solid var(--color-buy-border)' : '1px solid var(--color-sell-border)',
                  color: ch.enabled ? 'var(--color-buy)' : 'var(--color-sell)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {ch.enabled ? 'ENABLED' : 'DISABLED'}
              </button>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(ch.id, ch.name)}
                title="Remove Channel"
                style={{
                  background: 'var(--color-sell-bg)',
                  border: '1px solid var(--color-sell-border)',
                  color: 'var(--color-sell)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Expanded Tracked Videos Drawer */}
            {expandedChannelId === ch.id && (
              <div style={{
                width: '100%',
                marginTop: '14px',
                padding: '16px 18px',
                background: 'var(--bg-card-subtle)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '12px',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Film size={15} color="var(--color-brand)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Tracked Videos & Reels for {ch.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      📅 Sorted by Upload Date (DESC)
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedChannelId(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {loadingVideos[ch.id] ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    Loading tracked videos...
                  </div>
                ) : !channelVideos[ch.id] || channelVideos[ch.id].length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No analyzed videos found for this creator yet. Click <strong>"Scan Channel"</strong> above to ingest recent videos.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {channelVideos[ch.id].map((v, idx) => (
                      <div
                        key={v.video_id || idx}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div style={{ flex: '1 1 340px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <a
                              href={v.video_url || (v.platform === 'instagram' ? `https://www.instagram.com/reel/${v.video_id.replace('ig_', '')}/` : `https://www.youtube.com/watch?v=${v.video_id}`)}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: 'var(--text-primary)',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              onMouseEnter={(e) => e.target.style.color = 'var(--color-brand)'}
                              onMouseLeave={(e) => e.target.style.color = 'var(--text-primary)'}
                            >
                              {v.title}
                              <ExternalLink size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                            </a>
                          </div>

                          {/* Upload Date & Processed Meta */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                              📅 Uploaded: {v.published_at ? formatSingaporeDate(v.published_at) : 'Date Unknown'}
                            </span>
                            {v.platform === 'instagram' ? (
                              <span style={{ color: '#ec4899', fontWeight: '700' }}>📷 Instagram Reel</span>
                            ) : (
                              <span style={{ color: '#ef4444', fontWeight: '700' }}>🔴 YouTube</span>
                            )}
                          </div>

                          {/* Summary Excerpt if available */}
                          {v.summary_text && (
                            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                              {v.summary_text.substring(0, 180)}{v.summary_text.length > 180 ? '...' : ''}
                            </p>
                          )}
                        </div>

                        {/* Extracted Stock Calls / Tickers */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', maxWidth: '320px' }}>
                          {v.recommendations && v.recommendations.length > 0 ? (
                            v.recommendations.map((rec, rIdx) => {
                              const isBuy = rec.sentiment?.includes('BUY') || rec.sentiment?.includes('ACCUMULATE');
                              const isSell = rec.sentiment?.includes('SELL') || rec.sentiment?.includes('AVOID');
                              return (
                                <span
                                  key={rIdx}
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    background: isBuy ? 'var(--tag-buy-bg, rgba(16, 185, 129, 0.12))' : (isSell ? 'var(--tag-sell-bg, rgba(239, 68, 68, 0.12))' : 'var(--tag-hold-bg, rgba(245, 158, 11, 0.12))'),
                                    color: isBuy ? 'var(--tag-buy-text, #059669)' : (isSell ? 'var(--tag-sell-text, #dc2626)' : 'var(--tag-hold-text, #d97706)'),
                                    border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.25)' : (isSell ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)')}`
                                  }}
                                  title={`${rec.company_name || rec.ticker}: ${rec.sentiment}${rec.price_target ? ` | Target: $${rec.price_target}` : ''}`}
                                >
                                  {rec.ticker} • {rec.sentiment}
                                </span>
                              );
                            })
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Macro commentary / No tickers
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
        })}
      </div>
    </div>
  );
}
