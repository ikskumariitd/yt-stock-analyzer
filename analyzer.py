import os
import json
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from schema import VideoStockSummary

# Load environment variables
load_dotenv()


EXTRACTION_SYSTEM_PROMPT = """You are a World-Class Financial Analyst and Investment Intelligence Extractor.
Your task is to analyze the provided YouTube video transcript and extract all stock, ETF, crypto, or asset recommendations, investment ideas, and market commentary made by the video creator.

CRITICAL EXTRACTION GUIDELINES:
1. FOCUS ON SPECIFIC ACTIONABLE CALLS:
   - Identify every stock/asset the creator talks about buying, selling, accumulating, or adding to a watchlist.
   - Extract EXACT price levels (Buy zone, entry price, dip levels, breakout levels, stop losses, and target prices) as mentioned in the video.
   - If no specific price is stated, indicate what conditions they look for (e.g. "Wait for pullback to 200 EMA", "Dollar cost average under current price").

2. STRICT FACTUALITY & ACCURACY:
   - DO NOT invent or hallucinate price targets or tickers not discussed in the transcript.
   - If the creator does NOT give a target or stop loss, leave it as null/None.
   - Quote the creator's exact words or approximate reasoning in `quote_excerpt` and specify the timestamp `[MM:SS]` where this stock was discussed.

3. ACCURATE SENTIMENT CLASSIFICATION:
   - `STRONG_BUY`: High conviction, urgent opportunity, heavy sizing.
   - `BUY` / `ACCUMULATE`: Positive recommendation, DCA, building positions.
   - `WATCHLIST`: Interested but waiting for better levels / confirmations.
   - `HOLD`: Don't sell, but don't add aggressively.
   - `SELL` / `AVOID`: Bearish, trimming position, or warning viewers to stay away.

4. MARKET DIVERSITY:
   - Handle US stocks (NVDA, TSLA, AAPL, AMZN, MSFT, etc.)
   - Handle Indian NSE/BSE stocks (RELIANCE, HDFCBANK, TATASTEEL, INFY, ITC, etc.)
   - Handle Crypto, Commodities, Indices (SPY, QQQ, NIFTY, BANKNIFTY, BTC, ETH)
"""


DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")


def get_default_model() -> str:
    """Returns the configured model from environment, defaulting to latest Gemini 3 model (gemini-3.6-flash)."""
    return DEFAULT_MODEL


def analyze_transcript_with_gemini(
    transcript_data: Dict[str, Any],
    api_key: Optional[str] = None,
    model_name: Optional[str] = None
) -> VideoStockSummary:
    """
    Calls Gemini with structured schema output to extract stock recommendations from transcript.
    Defaults to latest flagship gemini-2.5-pro (or gemini-2.5-flash).
    """
    model_name = model_name or get_default_model()
    api_key = api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY not found. Please set the GEMINI_API_KEY environment variable or in a .env file."
        )

    title = transcript_data.get("title", "YouTube Financial Video")
    author = transcript_data.get("author", "Creator")
    timestamped_text = transcript_data.get("timestamped_text", "")
    
    user_prompt = f"""
Analyze the following YouTube video transcript:

VIDEO TITLE: {title}
CHANNEL / CREATOR: {author}

TRANSCRIPT WITH TIMESTAMPS:
{timestamped_text}

Extract all stock recommendations, buy levels, targets, stop-losses, and investment thesis into the structured schema.
"""

    # Try modern google-genai SDK first with retry backoff
    for attempt in range(3):
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model_name,
                contents=[user_prompt],
                config=types.GenerateContentConfig(
                    system_instruction=EXTRACTION_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=VideoStockSummary,
                    temperature=0.1,
                ),
            )
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            elif raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

            parsed_json = json.loads(raw_text)
            return VideoStockSummary.model_validate(parsed_json)

        except Exception as modern_err:
            if "429" in str(modern_err) or "503" in str(modern_err):
                import time
                time.sleep(2 ** attempt)
                continue

            # Fallback to google.generativeai SDK
            try:
                import google.generativeai as legacy_genai

                legacy_genai.configure(api_key=api_key)
                model = legacy_genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    system_instruction=EXTRACTION_SYSTEM_PROMPT,
                    generation_config={
                        "response_mime_type": "application/json",
                        "response_schema": VideoStockSummary,
                        "temperature": 0.1,
                    }
                )
                response = model.generate_content(user_prompt)
                raw_text = response.text.strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                elif raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()

                parsed_json = json.loads(raw_text)
                return VideoStockSummary.model_validate(parsed_json)
            except Exception as legacy_err:
                if attempt == 2:
                    raise RuntimeError(
                        f"Gemini API extraction failed: {modern_err} (fallback: {legacy_err})"
                    )

