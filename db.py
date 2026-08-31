import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = Path("stocks.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def init_db():
    """Initialize database tables with indexes and safe migrations."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Channels table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT UNIQUE,
            name TEXT NOT NULL,
            handle TEXT,
            url TEXT NOT NULL UNIQUE,
            platform TEXT DEFAULT 'youtube',
            enabled BOOLEAN DEFAULT 1,
            last_scanned_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Videos table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS videos (
            video_id TEXT PRIMARY KEY,
            channel_id TEXT,
            channel_name TEXT,
            title TEXT NOT NULL,
            published_at TEXT,
            video_url TEXT,
            platform TEXT DEFAULT 'youtube',
            market_outlook TEXT,
            summary_text TEXT,
            macro_takeaways TEXT, -- JSON array
            processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Recommendations table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            video_title TEXT,
            video_url TEXT,
            channel_name TEXT,
            platform TEXT DEFAULT 'youtube',
            published_at TEXT,
            ticker TEXT NOT NULL,
            company_name TEXT,
            market TEXT DEFAULT 'US',
            sentiment TEXT NOT NULL, -- BUY, STRONG_BUY, ACCUMULATE, WATCHLIST, HOLD, SELL, AVOID
            strategy_type TEXT, -- SWING_TRADE, LONG_TERM, VALUE_BUY, etc.
            current_price TEXT,
            buy_entry_zone TEXT,
            target_price TEXT,
            stop_loss TEXT,
            time_horizon TEXT,
            thesis TEXT, -- JSON array
            risks TEXT, -- JSON array
            quote_excerpt TEXT,
            timestamp_reference TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
        )
        """)

        # Migrations: Add platform column if missing on older DB schemas
        try:
            cursor.execute("ALTER TABLE channels ADD COLUMN platform TEXT DEFAULT 'youtube';")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE videos ADD COLUMN platform TEXT DEFAULT 'youtube';")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE recommendations ADD COLUMN platform TEXT DEFAULT 'youtube';")
        except sqlite3.OperationalError:
            pass

        # Scan Audit Log Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            channel_name TEXT,
            title TEXT,
            video_url TEXT,
            platform TEXT DEFAULT 'youtube',
            published_at TEXT,
            status TEXT DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'SKIPPED'
            stocks_count INTEGER DEFAULT 0,
            tickers_json TEXT, -- JSON array of tickers
            error_message TEXT,
            duration_seconds REAL DEFAULT 0,
            scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        try:
            cursor.execute("ALTER TABLE scan_audit_log ADD COLUMN published_at TEXT;")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE scan_audit_log ADD COLUMN model_used TEXT DEFAULT 'gemini-3.5-flash-lite';")
        except sqlite3.OperationalError:
            pass

        # App Settings Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Performance Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recs_ticker ON recommendations(ticker);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recs_published ON recommendations(published_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recs_channel ON recommendations(channel_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recs_sentiment ON recommendations(sentiment);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_scanned ON scan_audit_log(scanned_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_status ON scan_audit_log(status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_video ON scan_audit_log(video_id);")

        # Retroactive update: Mark any prior FAILED rows whose video subsequently succeeded as 'RERUN PASSED'
        cursor.execute("""
        UPDATE scan_audit_log
        SET status = 'RERUN PASSED'
        WHERE status = 'FAILED'
          AND video_id IN (
              SELECT video_id FROM scan_audit_log WHERE status = 'SUCCESS'
          );
        """)

        # Ensure all existing 8-digit published_at dates (YYYYMMDD) are migrated to standard ISO format (YYYY-MM-DD)
        cursor.execute("""
        UPDATE recommendations 
        SET published_at = substr(published_at, 1, 4) || '-' || substr(published_at, 5, 2) || '-' || substr(published_at, 7, 2)
        WHERE length(published_at) = 8 AND published_at GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
        """)
        cursor.execute("""
        UPDATE videos 
        SET published_at = substr(published_at, 1, 4) || '-' || substr(published_at, 5, 2) || '-' || substr(published_at, 7, 2)
        WHERE length(published_at) = 8 AND published_at GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
        """)
        cursor.execute("""
        UPDATE scan_audit_log 
        SET published_at = substr(published_at, 1, 4) || '-' || substr(published_at, 5, 2) || '-' || substr(published_at, 7, 2)
        WHERE length(published_at) = 8 AND published_at GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
        """)

        # Seed default channels from channels.json if channels table is empty
        cursor.execute("SELECT COUNT(*) FROM channels")
        if cursor.fetchone()[0] == 0:
            channels_json_path = Path("channels.json")
            if channels_json_path.exists():
                try:
                    default_channels = json.loads(channels_json_path.read_text(encoding="utf-8"))
                    for ch in default_channels:
                        cursor.execute("""
                        INSERT OR IGNORE INTO channels (name, url, handle, channel_id, platform, enabled)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            ch.get("name", "Channel"),
                            ch.get("url", ""),
                            ch.get("handle"),
                            ch.get("channel_id"),
                            ch.get("platform", "youtube"),
                            1 if ch.get("enabled", True) else 0
                        ))
                    conn.commit()
                except Exception as seed_err:
                    print(f"Initial channel seed error: {seed_err}")



def upsert_channel(name: str, url: str, handle: Optional[str] = None, channel_id: Optional[str] = None, enabled: bool = True, platform: str = "youtube"):
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Check if channel already exists by channel_id or url
        existing = None
        if channel_id:
            cursor.execute("SELECT id FROM channels WHERE channel_id = ?", (channel_id,))
            existing = cursor.fetchone()
        if not existing and url:
            cursor.execute("SELECT id FROM channels WHERE url = ?", (url,))
            existing = cursor.fetchone()

        if existing:
            cursor.execute("""
            UPDATE channels SET
                name = COALESCE(?, name),
                url = COALESCE(?, url),
                handle = COALESCE(?, handle),
                channel_id = COALESCE(?, channel_id),
                platform = COALESCE(?, platform),
                enabled = ?
            WHERE id = ?
            """, (name, url, handle, channel_id, platform, 1 if enabled else 0, existing[0]))
        else:
            cursor.execute("""
            INSERT INTO channels (name, url, handle, channel_id, platform, enabled)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (name, url, handle, channel_id, platform, 1 if enabled else 0))
        conn.commit()



def get_channels() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            c.*,
            (SELECT COUNT(*) FROM videos v WHERE 
                (v.channel_id IS NOT NULL AND v.channel_id != '' AND v.channel_id = c.channel_id) 
                OR LOWER(TRIM(REPLACE(v.channel_name, '@', ''))) = LOWER(TRIM(REPLACE(c.name, '@', '')))
                OR LOWER(TRIM(REPLACE(v.channel_name, '@', ''))) = LOWER(TRIM(REPLACE(COALESCE(c.handle, ''), '@', '')))
                OR (c.platform = 'instagram' AND LOWER(c.url) LIKE '%' || LOWER(TRIM(REPLACE(v.channel_name, '@', ''))) || '%')
            ) as analyzed_videos_count,
            (SELECT COUNT(*) FROM recommendations r WHERE 
                LOWER(TRIM(REPLACE(r.channel_name, '@', ''))) = LOWER(TRIM(REPLACE(c.name, '@', '')))
                OR LOWER(TRIM(REPLACE(r.channel_name, '@', ''))) = LOWER(TRIM(REPLACE(COALESCE(c.handle, ''), '@', '')))
                OR (c.platform = 'instagram' AND LOWER(c.url) LIKE '%' || LOWER(TRIM(REPLACE(r.channel_name, '@', ''))) || '%')
            ) as stock_picks_count
        FROM channels c
        ORDER BY c.name ASC
        """)
        return [dict(row) for row in cursor.fetchall()]


def get_channel_videos(channel_db_id: int) -> List[Dict[str, Any]]:
    """
    Returns all videos tracked for a specific channel/creator in descending order of upload date (published_at DESC).
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, handle, url, platform, channel_id FROM channels WHERE id = ?", (channel_db_id,))
        ch = cursor.fetchone()
        if not ch:
            return []

        ch_name = ch["name"]
        ch_handle = ch["handle"] or ""
        ch_yt_id = ch["channel_id"] or ""
        ch_url = ch["url"]
        platform = ch["platform"]

        cursor.execute("""
        SELECT v.video_id, v.channel_id, v.channel_name, v.title, v.video_url, v.published_at, v.platform,
               v.market_outlook, v.summary_text, v.processed_at,
               (SELECT json_group_array(json_object('ticker', r.ticker, 'sentiment', r.sentiment, 'company_name', r.company_name, 'target_price', r.target_price))
                FROM recommendations r WHERE r.video_id = v.video_id) as recommendations_json
        FROM videos v
        WHERE (v.channel_id IS NOT NULL AND v.channel_id != '' AND v.channel_id = ?)
           OR LOWER(TRIM(REPLACE(v.channel_name, '@', ''))) = LOWER(TRIM(REPLACE(?, '@', '')))
           OR LOWER(TRIM(REPLACE(v.channel_name, '@', ''))) = LOWER(TRIM(REPLACE(?, '@', '')))
           OR (? = 'instagram' AND LOWER(?) LIKE '%' || LOWER(TRIM(REPLACE(v.channel_name, '@', ''))) || '%')
        ORDER BY 
            CASE WHEN v.published_at IS NOT NULL AND v.published_at != '' THEN v.published_at ELSE v.processed_at END DESC
        """, (ch_yt_id, ch_name, ch_handle, platform, ch_url))

        rows = []
        for r in cursor.fetchall():
            item = dict(r)
            try:
                item["recommendations"] = json.loads(item.get("recommendations_json") or "[]")
            except Exception:
                item["recommendations"] = []
            rows.append(item)
        return rows


def delete_channel(channel_id: int):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM channels WHERE id = ?", (channel_id,))
        conn.commit()



def update_channel_scan_time(url_or_id: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE channels 
        SET last_scanned_at = CURRENT_TIMESTAMP 
        WHERE url = ? OR channel_id = ? OR handle = ?
        """, (url_or_id, url_or_id, url_or_id))
        conn.commit()


def is_video_processed(video_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM videos WHERE video_id = ?", (video_id,))
        return cursor.fetchone() is not None


def save_video_analysis(
    video_id: str,
    channel_id: str,
    channel_name: str,
    title: str,
    published_at: str,
    video_url: str,
    market_outlook: str,
    summary_text: str,
    macro_takeaways: List[str],
    recommendations: List[Any],
    platform: str = "youtube"
):
    published_at = normalize_date_for_sort(published_at)

    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Insert video
        cursor.execute("""
        INSERT OR REPLACE INTO videos (
            video_id, channel_id, channel_name, title, published_at,
            video_url, platform, market_outlook, summary_text, macro_takeaways, processed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            video_id,
            channel_id,
            channel_name,
            title,
            published_at,
            video_url,
            platform,
            market_outlook,
            summary_text,
            json.dumps(macro_takeaways or [])
        ))

        # Delete existing recommendations for this video to avoid duplicates on re-scan
        cursor.execute("DELETE FROM recommendations WHERE video_id = ?", (video_id,))

        # Insert recommendations
        for rec in recommendations:
            r = rec.model_dump() if hasattr(rec, "model_dump") else (rec if isinstance(rec, dict) else dict(rec))
            cursor.execute("""
            INSERT INTO recommendations (
                video_id, video_title, video_url, channel_name, platform, published_at,
                ticker, company_name, market, sentiment, strategy_type,
                current_price, buy_entry_zone, target_price, stop_loss,
                time_horizon, thesis, risks, quote_excerpt, timestamp_reference
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                video_id,
                title,
                video_url,
                channel_name,
                platform,
                published_at,
                r.get("ticker", "").upper(),
                r.get("company_name", ""),
                r.get("market", "US"),
                r.get("sentiment", "BUY").upper(),
                r.get("strategy_type", ""),
                r.get("current_price_mentioned"),
                r.get("buy_entry_zone", ""),
                r.get("target_price"),
                r.get("stop_loss"),
                r.get("time_horizon", ""),
                json.dumps(r.get("thesis_and_catalysts", [])),
                json.dumps(r.get("risk_factors", [])),
                r.get("quote_excerpt"),
                r.get("timestamp_reference")
            ))

        conn.commit()



SENTIMENT_SCORE = {
    "STRONG_BUY": 3,
    "STRONGBUY": 3,
    "BUY": 2,
    "ACCUMULATE": 1,
    "WATCHLIST": 0,
    "HOLD": 0,
    "NEUTRAL": 0,
    "SELL": -2,
    "AVOID": -2
}


def normalize_date_for_sort(d_str: Optional[str]) -> str:
    if not d_str:
        return ""
    s = str(d_str).strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return s


def enrich_recommendations_with_stance_evolution(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Enriches each recommendation with creator stance evolution (UPGRADED, DOWNGRADED, REITERATED, INITIAL).
    Uses full historical database context for each (ticker, creator) pair.
    """
    if not items:
        return []

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, ticker, channel_name, sentiment, target_price, buy_entry_zone,
                   published_at, created_at, video_title, video_url
            FROM recommendations
            ORDER BY id ASC
        """)
        all_recs = cursor.fetchall()

    history_map: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    for r in all_recs:
        t = (r["ticker"] or "").upper().strip()
        ch = (r["channel_name"] or "").strip().lower().replace("@", "")
        key = (t, ch)
        if key not in history_map:
            history_map[key] = []
        history_map[key].append(dict(r))

    # Sort each history group chronologically ASC using normalized date
    for key in history_map:
        history_map[key].sort(key=lambda x: (
            normalize_date_for_sort(x.get("published_at") or x.get("created_at")),
            x["id"]
        ))

    stance_meta: Dict[int, Dict[str, Any]] = {}
    for key, calls in history_map.items():
        for i, curr in enumerate(calls):
            cid = curr["id"]
            curr_sent = (curr.get("sentiment") or "BUY").upper().replace(" ", "_")
            curr_score = SENTIMENT_SCORE.get(curr_sent, 2)
            
            if i == 0:
                stance_meta[cid] = {
                    "stance_change": "INITIAL",
                    "previous_sentiment": None,
                    "previous_published_at": None,
                    "previous_target_price": None,
                    "previous_entry_zone": None,
                    "shift_delta": 0,
                    "call_sequence_index": 1,
                    "total_creator_calls": len(calls)
                }
            else:
                prev = calls[i - 1]
                prev_sent = (prev.get("sentiment") or "BUY").upper().replace(" ", "_")
                prev_score = SENTIMENT_SCORE.get(prev_sent, 2)
                delta = curr_score - prev_score
                
                if delta > 0:
                    change_type = "UPGRADED"
                elif delta < 0:
                    change_type = "DOWNGRADED"
                else:
                    change_type = "REITERATED"
                
                stance_meta[cid] = {
                    "stance_change": change_type,
                    "previous_sentiment": prev.get("sentiment"),
                    "previous_published_at": prev.get("published_at") or prev.get("created_at"),
                    "previous_target_price": prev.get("target_price"),
                    "previous_entry_zone": prev.get("buy_entry_zone"),
                    "shift_delta": delta,
                    "call_sequence_index": i + 1,
                    "total_creator_calls": len(calls)
                }

    for item in items:
        meta = stance_meta.get(item.get("id"), {
            "stance_change": "INITIAL",
            "previous_sentiment": None,
            "previous_published_at": None,
            "previous_target_price": None,
            "previous_entry_zone": None,
            "shift_delta": 0,
            "call_sequence_index": 1,
            "total_creator_calls": 1
        })
        item.update(meta)

    return items


def query_recommendations(
    search: Optional[str] = None,
    ticker: Optional[str] = None,
    sentiment: Optional[str] = None,
    channel_name: Optional[str] = None,
    market: Optional[str] = None,
    days: Optional[Any] = None,
    stance_change: Optional[str] = None,
    sort_by: str = "date",
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        query = "SELECT * FROM recommendations WHERE 1=1"
        params = []

        if search:
            query += " AND (ticker LIKE ? OR company_name LIKE ? OR video_title LIKE ? OR thesis LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param, s_param])

        if ticker:
            query += " AND ticker = ?"
            params.append(ticker.upper())

        if sentiment and sentiment.upper() != "ALL":
            sent_upper = sentiment.upper().replace(" ", "_")
            if sent_upper in ["SELL", "AVOID"]:
                query += " AND sentiment IN ('SELL', 'AVOID')"
            elif sent_upper in ["WATCHLIST", "HOLD"]:
                query += " AND sentiment IN ('WATCHLIST', 'HOLD')"
            elif sent_upper in ["STRONG_BUY", "STRONGBUY"]:
                query += " AND sentiment = 'STRONG_BUY'"
            elif sent_upper == "BUY":
                query += " AND sentiment = 'BUY'"
            elif sent_upper == "ACCUMULATE":
                query += " AND sentiment = 'ACCUMULATE'"
            else:
                query += " AND sentiment = ?"
                params.append(sentiment.upper())

        if channel_name and channel_name.upper() != "ALL":
            query += " AND (LOWER(TRIM(REPLACE(channel_name, '@', ''))) = LOWER(TRIM(REPLACE(?, '@', ''))))"
            params.append(channel_name.strip())

        if market and market.upper() != "ALL":
            query += " AND market = ?"
            params.append(market)

        if days:
            days_str = str(days).strip().upper()
            date_expr = "date(CASE WHEN length(published_at)=8 THEN substr(published_at,1,4)||'-'||substr(published_at,5,2)||'-'||substr(published_at,7,2) ELSE COALESCE(NULLIF(published_at, ''), created_at) END)"
            if days_str == "YTD":
                query += f" AND {date_expr} >= date('now', 'start of year')"
            elif days_str in ["1Y", "1 Y", "365"]:
                query += f" AND {date_expr} >= date('now', '-365 days')"
            elif days_str not in ["ALL", "MAX", "NONE", ""]:
                try:
                    num_days = int(days_str)
                    if num_days > 0:
                        query += f" AND {date_expr} >= date('now', ?)"
                        params.append(f"-{num_days} days")
                except ValueError:
                    pass

        # Count total
        count_query = query.replace("SELECT *", "SELECT COUNT(*)")
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        # Determine ORDER BY clause
        if sort_by == "bullish":
            order_clause = """ORDER BY 
                CASE sentiment 
                    WHEN 'STRONG_BUY' THEN 1 
                    WHEN 'BUY' THEN 2 
                    WHEN 'ACCUMULATE' THEN 3 
                    WHEN 'WATCHLIST' THEN 4 
                    WHEN 'HOLD' THEN 5 
                    WHEN 'NEUTRAL' THEN 6 
                    WHEN 'SELL' THEN 7 
                    WHEN 'AVOID' THEN 8 
                    ELSE 9 
                END ASC, 
                COALESCE(NULLIF(published_at, ''), created_at) DESC, id DESC"""
        elif sort_by == "ticker":
            order_clause = "ORDER BY ticker ASC, COALESCE(NULLIF(published_at, ''), created_at) DESC, id DESC"
        else:  # 'date' or 'mentions' for feed mode
            order_clause = "ORDER BY COALESCE(NULLIF(published_at, ''), created_at) DESC, id DESC"

        query += f" {order_clause} LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["thesis"] = json.loads(d.get("thesis") or "[]")
            except Exception:
                d["thesis"] = [d.get("thesis")] if d.get("thesis") else []
            try:
                d["risks"] = json.loads(d.get("risks") or "[]")
            except Exception:
                d["risks"] = [d.get("risks")] if d.get("risks") else []
            results.append(d)

        # Enrich with stance evolution
        results = enrich_recommendations_with_stance_evolution(results)

        if stance_change and stance_change.upper() != "ALL":
            sc = stance_change.upper()
            if sc == "CHANGES_ONLY":
                results = [r for r in results if r.get("stance_change") in ["UPGRADED", "DOWNGRADED"]]
            else:
                results = [r for r in results if r.get("stance_change") == sc]
            total = len(results)

        return {
            "total": total,
            "items": results,
            "limit": limit,
            "offset": offset
        }




def query_consensus(
    search: Optional[str] = None,
    sentiment: Optional[str] = None,
    channel_name: Optional[str] = None,
    market: Optional[str] = None,
    days: Optional[int] = None,
    stance_change: Optional[str] = None,
    sort_by: str = "mentions"
) -> List[Dict[str, Any]]:
    """Groups recommendations by stock ticker to show consensus across all creators with stance evolution."""
    all_recs = query_recommendations(
        search=search,
        sentiment=sentiment,
        channel_name=channel_name,
        market=market,
        days=days,
        limit=1000
    ).get("items", [])

    grouped: Dict[str, Dict[str, Any]] = {}

    for r in all_recs:
        ticker = r["ticker"].upper()
        if ticker not in grouped:
            grouped[ticker] = {
                "ticker": ticker,
                "company_name": r.get("company_name", ticker),
                "market": r.get("market", "US"),
                "latest_date": r.get("published_at") or r.get("created_at", ""),
                "sentiments": [],
                "targets": [],
                "entries": [],
                "channels": set(),
                "calls": []
            }

        g = grouped[ticker]
        g["sentiments"].append(r.get("sentiment", "BUY"))
        if r.get("target_price"):
            g["targets"].append(r["target_price"])
        if r.get("buy_entry_zone"):
            g["entries"].append(r["buy_entry_zone"])
        g["channels"].add(r.get("channel_name", "Unknown"))
        
        item_date = r.get("published_at") or r.get("created_at", "")
        if item_date and item_date > g["latest_date"]:
            g["latest_date"] = item_date

        g["calls"].append(r)

    # Format consensus summary
    results = []
    for ticker, data in grouped.items():
        total_calls = len(data["calls"])
        unique_creators = len(data["channels"])
        
        sentiment_counts = {}
        for s in data["sentiments"]:
            sentiment_counts[s] = sentiment_counts.get(s, 0) + 1
        
        # Sort calls by date DESC
        sorted_calls = sorted(
            data["calls"],
            key=lambda x: (x.get("published_at") or x.get("created_at") or ""),
            reverse=True
        )

        dominant_sentiment = max(sentiment_counts.items(), key=lambda x: x[1])[0]
        platforms = list(set(r.get("platform", "youtube") for r in data["calls"]))

        # Build creator evolution trajectories
        creator_evolutions = []
        creator_grouped_calls: Dict[str, List[Dict[str, Any]]] = {}
        for c in data["calls"]:
            ch = c.get("channel_name", "Creator")
            if ch not in creator_grouped_calls:
                creator_grouped_calls[ch] = []
            creator_grouped_calls[ch].append(c)

        upgrades_count = 0
        downgrades_count = 0
        reiterations_count = 0

        for ch, ch_calls in creator_grouped_calls.items():
            ch_calls_asc = sorted(
                ch_calls,
                key=lambda x: (x.get("published_at") or x.get("created_at") or "")
            )
            for c in ch_calls:
                if c.get("stance_change") == "UPGRADED":
                    upgrades_count += 1
                elif c.get("stance_change") == "DOWNGRADED":
                    downgrades_count += 1
                elif c.get("stance_change") == "REITERATED":
                    reiterations_count += 1

            if len(ch_calls) > 1:
                latest_call = ch_calls_asc[-1]
                first_call = ch_calls_asc[0]
                creator_evolutions.append({
                    "creator_name": ch,
                    "total_calls": len(ch_calls),
                    "first_stance": first_call.get("sentiment"),
                    "first_date": first_call.get("published_at") or first_call.get("created_at"),
                    "latest_stance": latest_call.get("sentiment"),
                    "latest_date": latest_call.get("published_at") or latest_call.get("created_at"),
                    "latest_stance_change": latest_call.get("stance_change"),
                    "steps": [
                        {
                            "id": c.get("id"),
                            "sentiment": c.get("sentiment"),
                            "stance_change": c.get("stance_change"),
                            "previous_sentiment": c.get("previous_sentiment"),
                            "published_at": c.get("published_at") or c.get("created_at"),
                            "target_price": c.get("target_price"),
                            "buy_entry_zone": c.get("buy_entry_zone"),
                            "video_title": c.get("video_title"),
                            "video_url": c.get("video_url")
                        }
                        for c in ch_calls_asc
                    ]
                })

        # Apply stance_change filter if requested
        if stance_change and stance_change.upper() != "ALL":
            sc = stance_change.upper()
            if sc == "UPGRADED" and upgrades_count == 0:
                continue
            elif sc == "DOWNGRADED" and downgrades_count == 0:
                continue
            elif sc == "REITERATED" and reiterations_count == 0:
                continue
            elif sc == "CHANGES_ONLY" and (upgrades_count == 0 and downgrades_count == 0):
                continue

        results.append({
            "ticker": ticker,
            "company_name": data["company_name"],
            "market": data["market"],
            "total_calls": total_calls,
            "unique_creators": unique_creators,
            "creator_names": list(data["channels"]),
            "platforms": platforms,
            "latest_date": data["latest_date"],
            "dominant_sentiment": dominant_sentiment,
            "sentiment_counts": sentiment_counts,
            "upgrades_count": upgrades_count,
            "downgrades_count": downgrades_count,
            "reiterations_count": reiterations_count,
            "has_stance_change": (upgrades_count > 0 or downgrades_count > 0),
            "creator_evolutions": creator_evolutions,
            "targets": list(set(data["targets"])),
            "entries": list(set(data["entries"])),
            "calls": sorted_calls
        })

    # Sort grouped stocks based on sort_by
    if sort_by == "date":
        results.sort(key=lambda x: (x["latest_date"] or "", x["total_calls"]), reverse=True)
    elif sort_by == "ticker":
        results.sort(key=lambda x: x["ticker"])
    elif sort_by == "bullish":
        results.sort(key=lambda x: (
            x["sentiment_counts"].get("STRONG_BUY", 0) + 
            x["sentiment_counts"].get("BUY", 0) + 
            x["sentiment_counts"].get("ACCUMULATE", 0),
            x["total_calls"]
        ), reverse=True)
    else:  # Default: mentions (recommended by many authors first)
        results.sort(key=lambda x: (x["total_calls"], x["unique_creators"], x["latest_date"] or ""), reverse=True)

    return results




def get_stats() -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM recommendations")
        total_recs = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT ticker) FROM recommendations")
        unique_tickers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT video_id) FROM videos")
        total_videos = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM channels WHERE enabled = 1")
        active_channels = cursor.fetchone()[0]

        # Sentiment distribution
        cursor.execute("""
        SELECT sentiment, COUNT(*) as count 
        FROM recommendations 
        GROUP BY sentiment
        """)
        sentiment_dist = {row["sentiment"]: row["count"] for row in cursor.fetchall()}

        # Top tickers
        cursor.execute("""
        SELECT ticker, company_name, COUNT(*) as mention_count,
               MAX(created_at) as last_mentioned
        FROM recommendations
        GROUP BY ticker
        ORDER BY mention_count DESC
        LIMIT 6
        """)
        top_tickers = [dict(row) for row in cursor.fetchall()]

        return {
            "total_recommendations": total_recs,
            "unique_tickers": unique_tickers,
            "total_videos_analyzed": total_videos,
            "active_channels": active_channels,
            "sentiment_distribution": sentiment_dist,
            "top_tickers": top_tickers
        }


def log_scan_audit(
    video_id: str,
    channel_name: str = "",
    title: str = "",
    video_url: str = "",
    platform: str = "youtube",
    published_at: Optional[str] = None,
    model_used: Optional[str] = "gemini-3.5-flash-lite",
    status: str = "SUCCESS",
    stocks_count: int = 0,
    tickers: Optional[List[str]] = None,
    error_message: Optional[str] = None,
    duration_seconds: float = 0.0
):
    with get_connection() as conn:
        cursor = conn.cursor()
        if status == "SUCCESS":
            # Update prior failed scans for this video to 'RERUN PASSED'
            cursor.execute(
                "UPDATE scan_audit_log SET status = 'RERUN PASSED' WHERE video_id = ? AND status = 'FAILED'",
                (video_id,)
            )

        cursor.execute("""
        INSERT INTO scan_audit_log (
            video_id, channel_name, title, video_url, platform, published_at, model_used,
            status, stocks_count, tickers_json, error_message, duration_seconds, scanned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            video_id,
            channel_name,
            title,
            video_url,
            platform,
            published_at,
            model_used or "gemini-3.5-flash-lite",
            status,
            stocks_count,
            json.dumps(tickers or []),
            error_message,
            round(duration_seconds, 2)
        ))
        conn.commit()


def get_scan_audit_logs(
    status: Optional[str] = None,
    platform: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Auto backfill from videos table if audit log is empty
        cursor.execute("SELECT COUNT(*) FROM scan_audit_log")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
            SELECT v.video_id, v.channel_name, v.title, v.video_url, v.platform, v.published_at, v.processed_at
            FROM videos v
            ORDER BY v.processed_at ASC
            """)
            videos = cursor.fetchall()
            for v in videos:
                v_dict = dict(v)
                vid = v_dict["video_id"]
                cursor.execute("SELECT ticker FROM recommendations WHERE video_id = ?", (vid,))
                tickers = list(dict.fromkeys([r[0] for r in cursor.fetchall()]))
                cursor.execute("""
                INSERT INTO scan_audit_log (
                    video_id, channel_name, title, video_url, platform, published_at,
                    status, stocks_count, tickers_json, error_message, scanned_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, NULL, ?)
                """, (
                    vid,
                    v_dict["channel_name"],
                    v_dict["title"],
                    v_dict["video_url"],
                    v_dict["platform"] or "youtube",
                    v_dict["published_at"],
                    len(tickers),
                    json.dumps(tickers),
                    v_dict["processed_at"] or datetime.now().isoformat()
                ))
            conn.commit()

        query = "SELECT * FROM scan_audit_log WHERE 1=1"
        params = []

        if status and status.upper() != "ALL":
            if status.upper() in ["SUCCESS", "PASS", "PASSED"]:
                query += " AND status IN ('SUCCESS', 'RERUN PASSED')"
            else:
                query += " AND status = ?"
                params.append(status.upper())

        if platform and platform.lower() != "all":
            query += " AND platform = ?"
            params.append(platform.lower())

        if search:
            query += " AND (title LIKE ? OR channel_name LIKE ? OR tickers_json LIKE ? OR video_id LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param, s_param])

        # Get total count
        count_query = query.replace("SELECT *", "SELECT COUNT(*)", 1)
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        # Summary statistics
        cursor.execute("SELECT COUNT(*) FROM scan_audit_log WHERE status IN ('SUCCESS', 'RERUN PASSED')")
        passed_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM scan_audit_log WHERE status = 'FAILED'")
        failed_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM scan_audit_log WHERE status = 'SKIPPED'")
        skipped_count = cursor.fetchone()[0]
        cursor.execute("SELECT SUM(stocks_count) FROM scan_audit_log")
        total_stocks_found = cursor.fetchone()[0] or 0

        # Fetch items
        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        cursor.execute(query, params)
        
        items = []
        for row in cursor.fetchall():
            item = dict(row)
            try:
                item["tickers"] = json.loads(item.get("tickers_json") or "[]")
            except Exception:
                item["tickers"] = []
            items.append(item)

        return {
            "total": total,
            "passed": passed_count,
            "failed": failed_count,
            "skipped": skipped_count,
            "total_stocks_found": total_stocks_found,
            "items": items
        }


def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    """Retrieves an application setting value from SQLite."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row[0] if row else default


def set_setting(key: str, value: Any):
    """Sets an application setting value in SQLite."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
        """, (key, str(value)))
        conn.commit()


DEFAULT_CASCADE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.7-flash"
]


def get_model_cascade() -> List[str]:
    """Returns the ordered list of Gemini models for the extraction cascade."""
    val = get_setting("gemini_model_cascade")
    if val:
        try:
            models = json.loads(val)
            if isinstance(models, list) and len(models) > 0:
                return models
        except Exception:
            pass
    return DEFAULT_CASCADE_MODELS.copy()


def set_model_cascade(models: List[str]):
    """Persists the user-configured Gemini model cascade order in SQLite."""
    if not isinstance(models, list) or len(models) == 0:
        models = DEFAULT_CASCADE_MODELS.copy()
    set_setting("gemini_model_cascade", json.dumps(models))


def purge_audit_logs(statuses: Optional[List[str]] = None) -> int:
    """
    Purges scan_audit_log entries matching specific statuses (default: SKIPPED, FAILED, FAIL, TOO LONG, TOO_LONG, RERUN PASSED, RERUN_PASSED).
    Returns the count of rows deleted.
    """
    if not statuses:
        statuses = ["SKIPPED", "FAILED", "FAIL", "TOO LONG", "TOO_LONG", "RERUN PASSED", "RERUN_PASSED", "PASSED (RERUN)"]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        placeholders = ", ".join(["?"] * len(statuses))
        cursor.execute(
            f"DELETE FROM scan_audit_log WHERE UPPER(status) IN ({placeholders})",
            [s.upper() for s in statuses]
        )
        deleted_count = cursor.rowcount
        conn.commit()
        return deleted_count


# Initialize DB on load
init_db()
