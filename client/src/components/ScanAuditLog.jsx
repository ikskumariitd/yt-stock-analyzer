import React, { useState, useEffect, useCallback } from 'react';
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
  TrendingUp
} from 'lucide-react';
import { fetchScanAudit, rescanVideo } from '../api';

export default function ScanAuditLog({ onRescanTriggered }) {
  const [auditData, setAuditData] = useState({
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    total_stocks_found: 0,
    items: []
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [rescanningId, setRescanningId] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchScanAudit({
        status: statusFilter,
        platform: platformFilter,
        search: search.trim() || undefined,
        limit: 100
      });
      setAuditData(data);
    } catch (err) {
      console.error('Failed to fetch scan audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, platformFilter, search]);

  useEffect(() => {
    loadAuditLogs();
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
      setTimeout(loadAuditLogs, 1500);
    } catch (err) {
      alert(`Re-scan failed: ${err.message}`);
    } finally {
      setRescanningId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
              Total Scans
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {auditData.total}
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
          {['ALL', 'SUCCESS', 'FAILED', 'SKIPPED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                background: statusFilter === st ? 'var(--color-brand)' : 'var(--bg-secondary)',
                color: statusFilter === st ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              {st === 'ALL' ? 'All' : st === 'SUCCESS' ? 'Passed' : st === 'FAILED' ? 'Failed' : 'Skipped'}
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
            onClick={loadAuditLogs}
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
        ) : auditData.items.length === 0 ? (
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
                  letterSpacing: '0.05em'
                }}>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Scan Time</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Platform</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Creator</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Video / Reel Title</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Stocks Found</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {auditData.items.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {item.scanned_at ? new Date(item.scanned_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
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

                    {/* Stocks Found */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {item.tickers && item.tickers.length > 0 ? (
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

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
