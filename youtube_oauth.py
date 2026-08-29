import os
import sys
import json
import socket
import urllib.parse
import urllib3.util.connection as urllib_conn
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# Force IPv4 to prevent WinError 10051 on unrouted IPv6 Windows networks
urllib_conn.allowed_gai_family = lambda: socket.AF_INET


TOKEN_FILE = Path("youtube_token.json")
CREDENTIALS_FILE = Path("client_secret.json")

SCOPES = "https://www.googleapis.com/auth/youtube.readonly"


def get_client_credentials() -> tuple[str, str]:
    """Retrieve Client ID and Client Secret from client_secret.json or environment."""
    if CREDENTIALS_FILE.exists():
        try:
            data = json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))
            web = data.get("web") or data.get("installed") or {}
            client_id = web.get("client_id")
            client_secret = web.get("client_secret")
            if client_id and client_secret:
                return client_id, client_secret
        except Exception:
            pass

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise ValueError(
            "OAuth credentials not configured. Please create an OAuth 2.0 Client ID in Google Cloud Console or set GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET."
        )
    return client_id, client_secret


def get_authorization_url(redirect_uri: str) -> str:
    """Generate direct Google OAuth 2.0 authorization URL without PKCE state mismatch."""
    client_id, _ = get_client_credentials()
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true"
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"


def exchange_code_for_credentials(code: str, redirect_uri: str) -> Credentials:
    """Directly exchange authorization code for access and refresh tokens without code_verifier error."""
    client_id, client_secret = get_client_credentials()
    token_url = "https://oauth2.googleapis.com/token"

    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }

    resp = requests.post(token_url, data=payload)
    if resp.status_code != 200:
        raise RuntimeError(f"Token exchange failed ({resp.status_code}): {resp.text}")

    token_data = resp.json()
    credentials = Credentials(
        token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_url,
        client_id=client_id,
        client_secret=client_secret,
        scopes=[SCOPES]
    )
    save_token(credentials)
    return credentials


def save_token(credentials: Credentials):
    """Save user OAuth credentials to disk for continuous background syncing."""
    token_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes
    }
    TOKEN_FILE.write_text(json.dumps(token_data, indent=2), encoding="utf-8")


def load_saved_credentials() -> Optional[Credentials]:
    """Load and refresh saved OAuth credentials."""
    if not TOKEN_FILE.exists():
        return None
    try:
        data = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
        creds = Credentials(
            token=data.get("token"),
            refresh_token=data.get("refresh_token"),
            token_uri=data.get("token_uri") or "https://oauth2.googleapis.com/token",
            client_id=data.get("client_id"),
            client_secret=data.get("client_secret"),
            scopes=data.get("scopes")
        )
        if creds and creds.refresh_token:
            try:
                creds.refresh(Request())
                save_token(creds)
            except Exception as re:
                print(f"Token refresh warning: {re}")
        return creds
    except Exception as e:
        print(f"Error loading saved token: {e}")
        return None


def fetch_live_youtube_subscriptions(credentials: Credentials) -> List[Dict[str, Any]]:
    """
    Calls YouTube Data API live endpoint to fetch all channels the user is subscribed to in real time.
    Endpoint: https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true
    """
    if credentials.refresh_token:
        try:
            credentials.refresh(Request())
            save_token(credentials)
        except Exception as e:
            print(f"Pre-fetch token refresh attempt: {e}")

    url = "https://www.googleapis.com/youtube/v3/subscriptions"
    params = {
        "part": "snippet",
        "mine": "true",
        "maxResults": 50
    }

    all_channels = []
    next_page_token = None

    while True:
        if next_page_token:
            params["pageToken"] = next_page_token

        headers = {"Authorization": f"Bearer {credentials.token}"}
        resp = requests.get(url, headers=headers, params=params)
        
        # If token expired mid-request, refresh and retry once
        if resp.status_code == 401 and credentials.refresh_token:
            print("Access token expired (401). Refreshing token and retrying...")
            try:
                credentials.refresh(Request())
                save_token(credentials)
                headers = {"Authorization": f"Bearer {credentials.token}"}
                resp = requests.get(url, headers=headers, params=params)
            except Exception as ref_err:
                print(f"Failed to refresh token after 401: {ref_err}")
                if TOKEN_FILE.exists():
                    TOKEN_FILE.unlink(missing_ok=True)
                raise PermissionError("YouTube login expired. Please reconnect your YouTube account.")

        if resp.status_code != 200:
            raise RuntimeError(f"YouTube API Error ({resp.status_code}): {resp.text}")

        data = resp.json()
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            title = snippet.get("title", "")
            resource = snippet.get("resourceId", {})
            channel_id = resource.get("channelId", "")

            if channel_id:
                all_channels.append({
                    "name": title,
                    "channel_id": channel_id,
                    "url": f"https://www.youtube.com/channel/{channel_id}",
                    "handle": title,
                    "enabled": True
                })

        next_page_token = data.get("nextPageToken")
        if not next_page_token or len(all_channels) >= 200:
            break

    return all_channels
