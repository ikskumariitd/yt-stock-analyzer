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

        # Performance Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recs_ticker ON recommendations(ticker);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recs_published ON recommendations(published_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recs_channel ON recommendations(channel_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recs_sentiment ON recommendations(sentiment);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled);")
        conn.commit()



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



def query_recommendations(
    search: Optional[str] = None,
    ticker: Optional[str] = None,
    sentiment: Optional[str] = None,
    channel_name: Optional[str] = None,
    market: Optional[str] = None,
    days: Optional[int] = None,
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
            query += " AND sentiment = ?"
            params.append(sentiment.upper())

        if channel_name and channel_name.upper() != "ALL":
            query += " AND TRIM(channel_name) = ?"
            params.append(channel_name.strip())

        if market and market.upper() != "ALL":
            query += " AND market = ?"
            params.append(market)

        if days and int(days) > 0:
            query += " AND date(COALESCE(NULLIF(published_at, ''), created_at)) >= date('now', ?)"
            params.append(f"-{int(days)} days")

        # Count total
        count_query = query.replace("SELECT *", "SELECT COUNT(*)")
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        # Fetch records sorted by video date DESC
        query += " ORDER BY COALESCE(NULLIF(published_at, ''), created_at) DESC, id DESC LIMIT ? OFFSET ?"
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
    sort_by: str = "mentions"
) -> List[Dict[str, Any]]:
    """Groups recommendations by stock ticker to show consensus across all creators."""
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
        
        # Keep latest date
        item_date = r.get("published_at") or r.get("created_at", "")
        if item_date and item_date > g["latest_date"]:
            g["latest_date"] = item_date

        g["calls"].append(r)

    # Format consensus summary
    results = []
    for ticker, data in grouped.items():
        total_calls = len(data["calls"])
        unique_creators = len(data["channels"])
        
        # Count sentiment frequencies
        sentiment_counts = {}
        for s in data["sentiments"]:
            sentiment_counts[s] = sentiment_counts.get(s, 0) + 1
        
        # Sort calls by date DESC
        sorted_calls = sorted(
            data["calls"],
            key=lambda x: (x.get("published_at") or x.get("created_at") or ""),
            reverse=True
        )

        # Dominant stance
        dominant_sentiment = max(sentiment_counts.items(), key=lambda x: x[1])[0]
        platforms = list(set(r.get("platform", "youtube") for r in data["calls"]))

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


# Initialize DB on load
init_db()
