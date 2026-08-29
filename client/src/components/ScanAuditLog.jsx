import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  FileText,
  Radio,
  Layers,
  ChevronRight,
  TrendingUp,
  Loader2,
  ListOrdered,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import { fetchScanAudit, rescanVideo } from '../api';
import { formatSingaporeAuditTime, formatSingaporeDate, parseUtcDate } from '../utils/timeUtils';

export default function ScanAuditLog({ onRescanTriggered }) {
  const [auditData, setAuditData] = useState({
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    queued: 0,
    total_stocks_found: 0,
    items: []
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [rescanningId, setRescanningId] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  // Sorting state: Default Scan Time DESC
  const [sortField, setSortField] = useState('scanned_at');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  const loadAuditLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await fetchScanAudit({
        status: statusFilter,
        platform: platformFilter,
        search: search.trim() || undefined,
        limit: 150
      });
      setAuditData(data);
    } catch (err) {
      console.error('Failed to fetch scan audit logs:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [statusFilter, platformFilter, search]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Auto-poll audit logs continuously every 3.5s so all queued and active items show up instantly
  useEffect(() => {
    const timer = setInterval(() => {
      loadAuditLogs(true);
    }, 3500);

    return () => clearInterval(timer);
  }, [loadAuditLogs]);

  const handleRescan = async (item) => {
    setRescanningId(item.video_id);
    try {
      const res = await rescanVideo({
        videoId: item.video_id,
        url: item.video_url,
        channelName: item.channel_name,
        title: item.title,
        platform: item.platform
      });
      setActionMsg(`⚡ Re-scan enqueued for "${item.title.substring(0, 40)}..."`);
      setTimeout(() => setActionMsg(null), 4000);
      if (onRescanTriggered) onRescanTriggered();
      setTimeout(() => loadAuditLogs(true), 800);
    } catch (err) {
      alert(`Re-scan failed: ${err.message}`);
    } finally {
      setRescanningId(null);
    }
  };

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      // Toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for newly clicked column
    }
  };

  // Client-side multi-column sorting
  const sortedItems = useMemo(() => {
    const items = [...auditData.items];

    return items.sort((a, b) => {
      // Always keep active processing/queued items at the very top if sorting by date desc
      if (sortField === 'scanned_at' && sortOrder === 'desc') {
        const isAActive = a.status === 'PROCESSING' || a.status === 'QUEUED';
        const isBActive = b.status === 'PROCESSING' || b.status === 'QUEUED';
        if (isAActive && !isBActive) return -1;
        if (!isAActive && isBActive) return 1;
      }

      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'scanned_at') {
        const timeA = a.scanned_at ? (parseUtcDate(a.scanned_at)?.getTime() || 0) : (a.status === 'PROCESSING' ? 9999999999999 : 0);
        const timeB = b.scanned_at ? (parseUtcDate(b.scanned_at)?.getTime() || 0) : (b.status === 'PROCESSING' ? 9999999999999 : 0);
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (sortField === 'published_at') {
        const timeA = a.published_at ? (parseUtcDate(a.published_at)?.getTime() || 0) : 0;
        const timeB = b.published_at ? (parseUtcDate(b.published_at)?.getTime() || 0) : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (sortField === 'stocks_count') {
        const countA = a.stocks_count || (a.tickers ? a.tickers.length : 0);
        const countB = b.stocks_count || (b.tickers ? b.tickers.length : 0);
        return sortOrder === 'asc' ? countA - countB : countB - countA;
      }

      // String comparison
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [auditData.items, sortField, sortOrder]);

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.35, marginLeft: '6px' }} />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={13} style={{ color: 'var(--color-brand)', marginLeft: '6px', fontWeight: '800' }} />
    ) : (
      <ArrowDown size={13} style={{ color: 'var(--color-brand)', marginLeft: '6px', fontWeight: '800' }} />
    );
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'PROCESSING':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '700',
            background: 'rgba(99, 102, 241, 0.15)',
            color: 'var(--color-brand, #6366f1)',
            border: '1px solid rgba(99, 102, 241, 0.35)'
          }}>
            <Loader2 size={13} className="spin" /> PROCESSING
          </span>
        );
      case 'QUEUED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '700',
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#d97706',
            border: '1px solid rgba(245, 158, 11, 0.25)'
          }}>
            <Clock size={13} /> QUEUED
          </span>
        );
      case 'SUCCESS':
      case 'PASS':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '700',
            background: 'var(--tag-buy-bg, rgba(16, 185, 129, 0.12))',
            color: 'var(--tag-buy-text, #059669)',
            border: '1px solid var(--tag-buy-border, rgba(16, 185, 129, 0.25))'
          }}>
            <CheckCircle2 size={13} /> PASSED
          </span>
        );
      case 'RERUN PASSED':
      case 'RERUN_PASSED':
      case 'PASSED (RERUN)':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '700',
            background: 'rgba(14, 165, 233, 0.12)',
            color: '#0284c7',
            border: '1px solid rgba(14, 165, 233, 0.3)'
          }}>
            <RotateCcw size={12} /> RERUN PASSED
          </span>
        );
      case 'FAILED':
      case 'FAIL':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '700',
            background: 'var(--tag-sell-bg, rgba(239, 68, 68, 0.12))',
            color: 'var(--tag-sell-text, #dc2626)',
            border: '1px solid var(--tag-sell-border, rgba(239, 68, 68, 0.25))'
          }}>
            <XCircle size={13} /> FAILED
          </span>
        );
      case 'SKIPPED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '700',
            background: 'var(--tag-accumulate-bg, rgba(59, 130, 246, 0.12))',
            color: 'var(--tag-accumulate-text, #2563eb)',
            border: '1px solid var(--tag-accumulate-border, rgba(59, 130, 246, 0.25))'
          }}>
            <Clock size={13} /> SKIPPED
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Toast Notification */}
      {actionMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: '600',
          fontSize: '0.85rem'
        }}>
          {actionMsg}
        </div>
      )}

      {/* Audit Stats Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Total Audits */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--color-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Total Scanned
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {auditData.total}
            </div>
          </div>
        </div>

        {/* Queued / In Progress */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: auditData.queued > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-secondary)',
            color: auditData.queued > 0 ? '#f59e0b' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {auditData.queued > 0 ? <Loader2 size={20} className="spin" /> : <ListOrdered size={20} />}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Queued / Active
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: auditData.queued > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
              {auditData.queued || 0}
            </div>
          </div>
        </div>

        {/* Passed Scans */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Passed (Success)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>
              {auditData.passed}
            </div>
          </div>
        </div>

        {/* Failed Scans */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Failed (Errors)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ef4444' }}>
              {auditData.failed}
            </div>
          </div>
        </div>

        {/* Total Stocks Found */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Stocks Identified
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {auditData.total_stocks_found}
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Search */}
        <div style={{
          position: 'relative',
          flex: '1 1 260px',
          minWidth: '220px'
        }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by Video Title, Creator, or Ticker (e.g. NVDA)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Status Pill Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginRight: '4px' }}>
            Status:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PROCESSING', label: '⚡ In Progress' },
            { id: 'QUEUED', label: '⏳ Queued' },
            { id: 'SUCCESS', label: '✅ Passed' },
            { id: 'FAILED', label: '🔴 Failed' },
            { id: 'SKIPPED', label: '⏭️ Skipped' }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                background: statusFilter === st.id ? 'var(--color-brand)' : 'var(--bg-secondary)',
                color: statusFilter === st.id ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Platform Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginRight: '4px' }}>
            Platform:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'youtube', label: '🔴 YouTube' },
            { id: 'instagram', label: '📷 Instagram' }
          ].map((pf) => (
            <button
              key={pf.id}
              onClick={() => setPlatformFilter(pf.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                background: platformFilter === pf.id ? 'var(--color-brand)' : 'var(--bg-secondary)',
                color: platformFilter === pf.id ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              {pf.label}
            </button>
          ))}

          {/* Refresh Button */}
          <button
            onClick={() => loadAuditLogs(false)}
            disabled={loading}
            title="Refresh Scan Audit Logs"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              marginLeft: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Audit Log Table / Cards */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        {loading && auditData.items.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: '600' }}>Loading Scan Audit History...</p>
          </div>
        ) : sortedItems.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
              No Scan Audit Records Found
            </h3>
            <p style={{ fontSize: '0.85rem' }}>
              Try adjusting your filter or search query.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.85rem'
            }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  userSelect: 'none'
                }}>
                  {/* Scan Time Header */}
                  <th
                    onClick={() => handleHeaderClick('scanned_at')}
                    style={{
                      padding: '14px 18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      color: sortField === 'scanned_at' ? 'var(--color-brand)' : 'var(--text-muted)'
                    }}
                    title="Click to sort by Scan Time"
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      SCAN TIME {renderSortIcon('scanned_at')}
                    </div>
                  </th>

                  {/* Video Upload Date Header */}
                  <th
                    onClick={() => handleHeaderClick('published_at')}
                    style={{
                      padding: '14px 18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      color: sortField === 'published_at' ? 'var(--color-brand)' : 'var(--text-muted)'
                    }}
                    title="Click to sort by Video Upload / Published Date"
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      UPLOAD DATE {renderSortIcon('published_at')}
                    </div>
                  </th>

                  {/* Platform Header */}
                  <th
                    onClick={() => handleHeaderClick('platform')}
                    style={{
                      padding: '14px 18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      color: sortField === 'platform' ? 'var(--color-brand)' : 'var(--text-muted)'
                    }}
                    title="Click to sort by Platform"
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      PLATFORM {renderSortIcon('platform')}
                    </div>
                  </th>

                  {/* Creator Header */}
                  <th
                    onClick={() => handleHeaderClick('channel_name')}
                    style={{
                      padding: '14px 18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      color: sortField === 'channel_name' ? 'var(--color-brand)' : 'var(--text-muted)'
                    }}
                    title="Click to sort by Creator"
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      CREATOR {renderSortIcon('channel_name')}
                    </div>
                  </th>

                  {/* Video / Reel Title Header */}
                  <th
                    onClick={() => handleHeaderClick('title')}
                    style={{
                      padding: '14px 18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      color: sortField === 'title' ? 'var(--color-brand)' : 'var(--text-muted)'
                    }}
                    title="Click to sort by Video Title"
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      VIDEO / REEL TITLE {renderSortIcon('title')}
                    </div>
                  </th>

                  {/* Status Header */}
                  <th
                    onClick={() => handleHeaderClick('status')}
                    style={{
                      padding: '14px 18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      color: sortField === 'status' ? 'var(--color-brand)' : 'var(--text-muted)'
                    }}
                    title="Click to sort by Pass/Fail Status"
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      STATUS {renderSortIcon('status')}
                    </div>
                  </th>

                  {/* Actions Header (Placed right after Status) */}
                  <th style={{ padding: '14px 18px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                    ACTION
                  </th>

                  {/* AI Model Header */}
                  <th
                    onClick={() => handleHeaderClick('model_used')}
                    style={{
                      padding: '14px 18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      color: sortField === 'model_used' ? 'var(--color-brand)' : 'var(--text-muted)'
                    }}
                    title="Click to sort by Gemini Model Used"
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      AI MODEL {renderSortIcon('model_used')}
                    </div>
                  </th>

                  {/* Stocks Found Header */}
                  <th
                    onClick={() => handleHeaderClick('stocks_count')}
                    style={{
                      padding: '14px 18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      color: sortField === 'stocks_count' ? 'var(--color-brand)' : 'var(--text-muted)'
                    }}
                    title="Click to sort by Stocks Found"
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      STOCKS FOUND {renderSortIcon('stocks_count')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: item.status === 'PROCESSING' ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (item.status !== 'PROCESSING') e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      if (item.status !== 'PROCESSING') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {/* Scan Timestamp */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {item.status === 'PROCESSING' ? (
                        <span style={{ color: 'var(--color-brand)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Loader2 size={12} className="spin" /> Right Now
                        </span>
                      ) : item.status === 'QUEUED' ? (
                        <span style={{ color: '#d97706', fontWeight: '600' }}>In Queue</span>
                      ) : item.scanned_at ? (
                        formatSingaporeAuditTime(item.scanned_at)
                      ) : 'Recent'}
                    </td>

                    {/* Video Upload / Published Date */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {item.published_at ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          📅 {formatSingaporeDate(item.published_at)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Platform Badge */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      {item.platform === 'instagram' ? (
                        <span style={{
                          background: 'rgba(225, 48, 108, 0.12)',
                          color: '#e1306c',
                          border: '1px solid rgba(225, 48, 108, 0.3)',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          📷 Instagram
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          🔴 YouTube
                        </span>
                      )}
                    </td>

                    {/* Creator */}
                    <td style={{ padding: '14px 18px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {item.channel_name || 'Creator'}
                    </td>

                    {/* Title & Link */}
                    <td style={{ padding: '14px 18px', maxWidth: '380px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <a
                          href={item.video_url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: 'var(--text-primary)',
                            fontWeight: '600',
                            textDecoration: 'none',
                            lineHeight: '1.4',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => e.target.style.color = 'var(--color-brand)'}
                          onMouseLeave={(e) => e.target.style.color = 'var(--text-primary)'}
                          title={item.title}
                        >
                          {item.title}
                        </a>
                        {item.video_url && (
                          <a
                            href={item.video_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      {item.error_message && (
                        <div style={{
                          fontSize: '0.72rem',
                          color: item.status === 'FAILED' ? '#ef4444' : 'var(--text-muted)',
                          marginTop: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertTriangle size={11} /> {item.error_message}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      {getStatusBadge(item.status)}
                    </td>

                    {/* Actions (Placed right after Status) */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      {item.status === 'PROCESSING' || item.status === 'QUEUED' ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          In Progress
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRescan(item)}
                          disabled={rescanningId === item.video_id}
                          title="Trigger a fresh re-scan of this video"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-brand)';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          <RotateCcw size={12} className={rescanningId === item.video_id ? 'spin' : ''} />
                          {rescanningId === item.video_id ? 'Scanning...' : 'Re-Scan'}
                        </button>
                      )}
                    </td>

                    {/* AI Model Badge */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      {item.status === 'PROCESSING' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: 'var(--color-brand)',
                          border: '1px solid rgba(99, 102, 241, 0.25)'
                        }}>
                          <Loader2 size={10} className="spin" /> Selecting
                        </span>
                      ) : item.status === 'QUEUED' ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          background: item.model_used && item.model_used.includes('3.6') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                          color: item.model_used && item.model_used.includes('3.6') ? '#059669' : '#4f46e5',
                          border: item.model_used && item.model_used.includes('3.6') ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(99, 102, 241, 0.2)'
                        }}>
                          <Sparkles size={11} color={item.model_used && item.model_used.includes('3.6') ? '#059669' : '#6366f1'} />
                          {item.model_used || 'gemini-3.5-flash-lite'}
                        </span>
                      )}
                    </td>

                    {/* Stocks Found */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {item.status === 'PROCESSING' ? (
                          <span style={{ color: 'var(--color-brand)', fontSize: '0.75rem', fontWeight: '600' }}>
                            Analyzing with Gemini...
                          </span>
                        ) : item.status === 'QUEUED' ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Waiting in line
                          </span>
                        ) : item.tickers && item.tickers.length > 0 ? (
                          item.tickers.map((tk) => (
                            <span
                              key={tk}
                              style={{
                                background: 'var(--bg-secondary)',
                                color: 'var(--color-brand)',
                                border: '1px solid var(--border-subtle)',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: '800'
                              }}
                            >
                              {tk}
                            </span>
                          ))
                        ) : item.status === 'SUCCESS' ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>0 stocks</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
