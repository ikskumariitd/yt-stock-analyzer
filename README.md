# AlphaPulse: YouTube Stock Intelligence Platform 📈

An AI-powered financial intelligence platform that monitors subscribed YouTube financial creators, extracts structured stock recommendations, key entry levels, targets, and sentiment, and presents them in a modern React dashboard.

---

## ⚡ Features

- **🧠 Gemini 3.6 / 3.7 Flash Extraction**: Extracts structured stock calls, buy/entry zones, price targets, stop losses, and catalyst theses.
- **🛡️ 1-at-a-Time Sequential Queue**: Asynchronous FIFO worker that processes videos sequentially with a 3-second cooldown to guarantee zero 429 rate-limit errors on Google Free Tier.
- **⚡ Instant Deduplication**: Never re-analyzes previously processed videos (0 duplicate tokens).
- **🔗 Live YouTube OAuth Integration**: 1-click real-time sync of all your YouTube account subscriptions via YouTube Data API.
- **📊 Glassmorphic React Dashboard**: Real-time filtering by Ticker, Sentiment, and Creator, deep-dive modal, and direct clickable YouTube timestamp links.
- **🐳 Cloud & Docker Ready**: Multi-stage `Dockerfile` ready for deployment on Google Cloud Run, Render, or Railway.

---

## 🛠️ Quick Start

### 1. Clone & Setup
```bash
git clone <your-repo-url>
cd yt-stock-analyzer
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your Gemini API Key:
```bash
cp .env.example .env
```

### 3. Build & Run
```bash
# Build React frontend
cd client
npm install
npm run build
cd ..

# Start FastAPI full-stack server
python server.py
```
Open **`http://127.0.0.1:8000`** in your browser.

---

## 📦 Project Structure

```
├── client/                     # React 18 + Vite frontend
│   ├── src/                    # Components (StockCard, FilterBar, ChannelManager, etc.)
│   └── package.json
├── server.py                   # FastAPI REST server & static bundle host
├── scan_queue.py               # Sequential FIFO 1-at-a-time scan queue
├── db.py                       # SQLite database & query repository
├── analyzer.py                 # Gemini structured output engine
├── transcript_extractor.py     # Subtitle extraction & timestamp parser
├── channel_scanner.py          # Public RSS discovery & handle resolver
├── youtube_oauth.py            # Live YouTube OAuth 2.0 sync
├── Dockerfile                  # Multi-stage production container
└── requirements.txt            # Python dependencies
```

---

## 📜 License
MIT License.
