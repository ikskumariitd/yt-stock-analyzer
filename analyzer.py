import os
import json
import time
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from schema import VideoStockSummary

# Load environment variables
load_dotenv()


EXTRACTION_SYSTEM_PROMPT = """You are a World-Class Financial Analyst and Investment Intelligence Extractor.
Your task is to analyze the provided financial video/media (YouTube transcript, Instagram Reel audio/video, or caption) and extract all stock, ETF, crypto, or asset recommendations, investment ideas, and market commentary made by the creator.

CRITICAL EXTRACTION GUIDELINES:
1. FOCUS ON SPECIFIC ACTIONABLE CALLS:
   - Identify every stock/asset the creator talks about buying, selling, accumulating, or adding to a watchlist.
   - Extract EXACT price levels (Buy zone, entry price, dip levels, breakout levels, stop losses, and target prices) as mentioned in the video or audio.
   - If no specific price is stated, indicate what conditions they look for (e.g. "Wait for pullback to 200 EMA", "Dollar cost average under current price").

2. STRICT FACTUALITY & ACCURACY:
   - DO NOT invent or hallucinate price targets or tickers not discussed in the media.
   - If the creator does NOT give a target or stop loss, leave it as null/None.
   - Quote the creator's exact words or approximate reasoning in `quote_excerpt` and specify the timestamp `[MM:SS]` where this stock was discussed.

3. ACCURATE SENTIMENT CLASSIFICATION:
   - `STRONG_BUY`: High conviction, urgent opportunity, heavy sizing.
   - `BUY` / `ACCUMULATE`: Positive recommendation, DCA, building positions.
   - `WATCHLIST`: Interested but waiting for better levels / confirmations.
   - `HOLD`: Don't sell, but don't add aggressively.
   - `SELL` / `AVOID`: Bearish, trimming position, or warning viewers to stay away.

4. MARKET DIVERSITY:
   - Handle US stocks (NVDA, TSLA, AAPL, AMZN, MSFT, PLTR, APP, ZETA, etc.)
   - Handle Indian NSE/BSE stocks (RELIANCE, HDFCBANK, TATASTEEL, INFY, etc.)
   - Handle Crypto, Commodities, Indices (SPY, QQQ, NIFTY, BTC, ETH)
"""

# Cascade of fast, intelligent models for high free-tier resilience
CASCADE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.7-flash"
]


def analyze_transcript_with_gemini(
    transcript_data: Dict[str, Any],
    api_key: Optional[str] = None,
    model_name: Optional[str] = None
) -> VideoStockSummary:
    """
    Sends timestamped video transcript to Gemini with structured schema output.
    Uses an intelligent multi-model cascade with exponential backoff for free-tier resilience.
    """
    api_key = api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY not found. Please set the GEMINI_API_KEY environment variable or in a .env file."
        )

    title = transcript_data.get("title", "Financial Video")
    author = transcript_data.get("author", "Creator")
    timestamped_text = transcript_data.get("timestamped_text", "")
    
    user_prompt = f"""Analyze the following video transcript and extract all stock recommendations:

VIDEO TITLE: {title}
CHANNEL / CREATOR: {author}

TRANSCRIPT WITH TIMESTAMPS:
{timestamped_text}

Extract all stock recommendations, buy levels, targets, stop-losses, and investment thesis into the structured JSON schema.
"""

    models_to_try = [model_name] if model_name else CASCADE_MODELS
    last_error = None

    for current_model in models_to_try:
        for attempt in range(2):
            try:
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=current_model,
                    contents=[user_prompt],
                    config=types.GenerateContentConfig(
                        system_instruction=EXTRACTION_SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        response_schema=VideoStockSummary,
                        temperature=0.1,
                    ),
                )
                
                raw_text = response.text.strip() if response and response.text else ""
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                elif raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()

                if not raw_text:
                    raise ValueError("Gemini returned empty response text")

                parsed_json = json.loads(raw_text)
                return VideoStockSummary.model_validate(parsed_json)

            except Exception as err:
                last_error = err
                err_str = str(err)
                print(f"[Gemini Model: {current_model} (Attempt {attempt+1})] Failed: {err_str[:120]}")
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    time.sleep(2.5 * (attempt + 1))
                else:
                    break  # Move to next model immediately for other errors

    raise RuntimeError(
        f"All Gemini models in cascade failed to analyze video. Last error: {last_error}"
    )


def analyze_instagram_media_with_gemini(
    ig_data: Dict[str, Any],
    api_key: Optional[str] = None,
    model_name: Optional[str] = None
) -> VideoStockSummary:
    """
    Sends Instagram Reel audio file + caption text (or YouTube fallback audio) to Gemini Multimodal for spoken stock extraction.
    """
    api_key = api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found.")

    title = ig_data.get("title", "Financial Media")
    author = ig_data.get("author", "@creator")
    caption = ig_data.get("caption", "")
    media_path = ig_data.get("media_path")

    prompt_text = f"""Analyze the audio & caption of this financial media and extract all stock calls:

CREATOR / HANDLE: {author}
TITLE / PREVIEW: {title}

POST CAPTION & DETAILS:
{caption}

Listen to the spoken audio and extract every mentioned stock/ticker, sentiment, buy target, and thesis into the structured JSON schema.
"""

    models_to_try = [model_name] if model_name else CASCADE_MODELS
    last_error = None

    for current_model in models_to_try:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            contents = []

            # Upload audio file if present
            uploaded_file = None
            if media_path and os.path.exists(media_path):
                try:
                    uploaded_file = client.files.upload(file=media_path)
                    contents.append(uploaded_file)
                except Exception as up_err:
                    print(f"Audio upload warning (falling back to caption prompt): {up_err}")

            contents.append(prompt_text)

            response = client.models.generate_content(
                model=current_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=EXTRACTION_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=VideoStockSummary,
                    temperature=0.1,
                ),
            )

            if uploaded_file:
                try:
                    client.files.delete(name=uploaded_file.name)
                except Exception:
                    pass

            raw_text = response.text.strip() if response and response.text else ""
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            elif raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

            if not raw_text:
                raise ValueError("Gemini returned empty response text")

            parsed_json = json.loads(raw_text)
            return VideoStockSummary.model_validate(parsed_json)

        except Exception as err:
            last_error = err
            print(f"[Gemini Multimodal Model: {current_model}] Failed: {str(err)[:120]}")
            continue

    raise RuntimeError(
        f"All Gemini models in cascade failed to analyze media. Last error: {last_error}"
    )
