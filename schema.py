from typing import List, Optional
from pydantic import BaseModel, Field


class StockRecommendation(BaseModel):
    ticker: str = Field(
        description="Stock symbol or ticker (e.g., NVDA, AAPL, RELIANCE, INFY, BTC, SPY)."
    )
    company_name: str = Field(
        description="Full name of the company, asset, or index."
    )
    market: str = Field(
        default="US",
        description="Market region (e.g., US, India / NSE, Crypto, Global).",
    )
    sentiment: str = Field(
        description="Call action: STRONG_BUY, BUY, ACCUMULATE, WATCHLIST, HOLD, SELL, or AVOID."
    )
    strategy_type: str = Field(
        description="Type of play: LONG_TERM_INVESTMENT, SWING_TRADE, BREAKOUT, DIP_BUY, VALUE_BUY, or INTRADAY."
    )
    current_price_mentioned: Optional[str] = Field(
        default=None,
        description="Current price of the stock mentioned in the video (if stated).",
    )
    buy_entry_zone: str = Field(
        description="Specific buy price, range, or entry condition (e.g. '$120-$125', 'Pullback to 50 EMA', 'Above $150 breakout')."
    )
    target_price: Optional[str] = Field(
        default=None,
        description="Target price or expected percentage gain (e.g. '$160 (30% upside)', '₹3000').",
    )
    stop_loss: Optional[str] = Field(
        default=None,
        description="Stop loss or invalidation level (e.g. 'Below $112', 'Close below ₹2200').",
    )
    time_horizon: str = Field(
        description="Holding timeframe (e.g. 'Days/Weeks', '1-3 Months', '6-12 Months', '3-5 Years')."
    )
    thesis_and_catalysts: List[str] = Field(
        default_factory=list,
        description="Key reasons, fundamental catalysts, earnings, or technical chart patterns mentioned.",
    )
    risk_factors: List[str] = Field(
        default_factory=list,
        description="Key risks or caveats highlighted by the creator.",
    )
    timestamp_reference: Optional[str] = Field(
        default=None,
        description="Video timestamp where this stock is discussed (e.g. '04:25').",
    )
    quote_excerpt: Optional[str] = Field(
        default=None,
        description="Short direct quote from the speaker summarizing their recommendation.",
    )


class VideoStockSummary(BaseModel):
    video_title: str = Field(
        description="Title or topic of the analyzed video."
    )
    market_outlook: str = Field(
        description="Overall macro market bias expressed in the video (e.g., Bullish, Cautiously Bullish, Bearish, Sideways)."
    )
    creator_summary: str = Field(
        description="A concise 2-3 sentence executive summary of the entire video's investment theme."
    )
    recommendations: List[StockRecommendation] = Field(
        default_factory=list,
        description="List of all individual stock, ETF, or asset recommendations found in the video.",
    )
    macro_key_takeaways: List[str] = Field(
        default_factory=list,
        description="Key macroeconomic, sector, or market-wide insights discussed in the video.",
    )
    model_used: Optional[str] = Field(
        default="gemini-3.5-flash-lite",
        description="Gemini model that performed extraction."
    )
