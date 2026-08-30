# AlphaPulse: AI Stock Intelligence & Creator Radar 📈

**AlphaPulse** is an AI-powered financial intelligence platform that monitors top financial creators across **YouTube** and **Instagram Reels**, extracts structured stock recommendations, key entry levels, price targets, stop losses, and catalyst theses, and presents them in a sleek, glassmorphic React dashboard.

---

## ⚡ Key Highlights & Capabilities

- **🧠 Gemini Multi-Model Cascade & Fallback**: Configurable priority cascade (`gemini-3.5-flash-lite` $\rightarrow$ `gemini-3.6-flash` $\rightarrow$ `gemini-3.7-flash`, etc.) with user priority reordering UI and automatic per-model timeout cascades (`35s` text / `55s` audio).
- **⏱️ 1-Hour Duration Limit Pre-Check**: Instantly skips long live streams (> 1 hr) in 0.0s before downloading audio or using API quota.
- **🎥 Multi-Platform Ingestion**: Scans **YouTube Channels** (quota-free RSS + synchronized audio fallback) and **Instagram Reels** with creator handle auto-discovery.
- **🛡️ 1-at-a-Time Sequential Queue**: Asynchronous FIFO worker that processes videos sequentially with configurable cooldowns to guarantee zero 429 rate-limit errors on Google Free Tier.
- **⚡ Instant Smart Deduplication**: Automatically skips previously analyzed videos (0 duplicate tokens).
- **🏛️ Consensus Stock Radar**: Aggregates creator intelligence by ticker with dominant consensus stance, price target ranges, multi-creator breakdown timelines, and video upload dates.
- **🚀 Conviction & Stance Filters**: Dedicated filter pills for **`🚀 Strong Buy`**, **`🟢 Buy`**, **`🔵 Accumulate`**, **`🟡 Watchlist`**, and **`🔴 Sell / Avoid`**.
- **🎬 Creator Tracked Videos Drawer**: Click `🎬 Videos Tracked` on any creator card to view their complete analyzed video catalog strictly ordered by **Upload Date DESC (`published_at DESC`)** with direct video links and stock calls.
- **📜 Scan Audit & History**: Full audit trail table tracking all scan attempts (`PASSED`, `SKIPPED`, `FAILED`, `TOO LONG`) with a 1-click **`Purge Inactive & Re-runs`** cleanup tool.
- **🕒 Singapore Time (SGT / UTC+8)**: All video upload dates, scan timestamps, and creator activity are formatted strictly in SGT.
- **🔗 Live YouTube OAuth Integration**: 1-click real-time sync of all your YouTube account subscriptions via YouTube Data API v3.
- **🐳 Cloud & Docker Ready**: Multi-stage `Dockerfile` and Google Cloud Run deployment scripts included.

---

## 🛠️ Quick Start Guide

### 1. Clone & Setup Python Virtual Environment
```bash
git clone https://github.com/ikskumariitd/yt-stock-analyzer.git
cd yt-stock-analyzer
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Gemini API Key:
```bash
cp .env.example .env
```
*(Optionally add RapidAPI keys for Instagram extraction or Google OAuth Client credentials).*

### 3. Build Frontend & Launch Server
```bash
# Build React frontend
cd client
npm install
npm run build
cd ..

# Start full-stack FastAPI server
python server.py
```
Open **[`http://127.0.0.1:8000`](http://127.0.0.1:8000)** in your browser.

---

## 📦 Project Structure

```
├── client/                     # React 18 + Vite frontend
│   ├── src/
│   │   ├── components/         # ConsensusView, StockCard, FilterBar, ChannelManager, ScanAuditLog
│   │   ├── utils/              # Singapore Time (SGT) formatting utilities
│   │   ├── api.js              # Centralized backend API client
│   │   └── App.jsx             # Main dashboard shell
│   └── package.json
├── server.py                   # FastAPI application & REST endpoint orchestrator
├── scan_queue.py               # Sequential FIFO 1-at-a-time scan queue & duration check
├── db.py                       # SQLite repository (channels, videos, recommendations, audit log)
├── analyzer.py                 # Gemini multi-model fallback cascade engine
├── transcript_extractor.py     # Subtitle extraction & yt-dlp duration metadata probe
├── instagram_extractor.py      # Instagram Reel discovery & metadata extraction
├── channel_scanner.py          # Public RSS discovery & handle resolver
├── youtube_oauth.py            # Live YouTube OAuth 2.0 sync
├── schema.py                   # Pydantic structured output models
├── AGENTS.md                   # Comprehensive developer & AI agent guidelines
├── Dockerfile                  # Multi-stage production container
└── requirements.txt            # Python dependencies
```

---

## 📜 License
MIT License.
