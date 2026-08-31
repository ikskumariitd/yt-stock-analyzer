# Automated Deployment Script for Google Cloud Run (Free Tier)
$PROJECT_ID = "stock-analyzer-ik2024"
$SERVICE_NAME = "stock-analyzer"
$REGION = "us-central1"

# Load from .env if environment variables are not set
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $k = $parts[0].Trim()
            $v = $parts[1].Trim()
            if (-not [Environment]::GetEnvironmentVariable($k)) {
                [Environment]::SetEnvironmentVariable($k, $v)
            }
        }
    }
}

$API_KEY = $env:GEMINI_API_KEY
$RAPIDAPI_KEY = $env:RAPIDAPI_KEY
$RAPIDAPI_HOST = $env:RAPIDAPI_HOST
$GEMINI_MODEL = if ($env:GEMINI_MODEL) { $env:GEMINI_MODEL } else { "gemini-3.6-flash" }
$YOUTUBE_PROXY = $env:YOUTUBE_PROXY
$YOUTUBE_COOKIES_CONTENT = $env:YOUTUBE_COOKIES_CONTENT
$YOUTUBE_COOKIES_BASE64 = $env:YOUTUBE_COOKIES_BASE64
$WEBSHARE_PROXY_USERNAME = $env:WEBSHARE_PROXY_USERNAME
$WEBSHARE_PROXY_PASSWORD = $env:WEBSHARE_PROXY_PASSWORD

# If local cookies.txt exists and YOUTUBE_COOKIES_CONTENT is not set, load it
if (-not $YOUTUBE_COOKIES_CONTENT -and -not $YOUTUBE_COOKIES_BASE64) {
    if (Test-Path "cookies.txt") {
        Write-Host "Found local cookies.txt - packaging for Cloud Run..." -ForegroundColor Cyan
        $YOUTUBE_COOKIES_CONTENT = [System.IO.File]::ReadAllText("$PWD/cookies.txt")
    } elseif (Test-Path "youtube_cookies.txt") {
        Write-Host "Found local youtube_cookies.txt - packaging for Cloud Run..." -ForegroundColor Cyan
        $YOUTUBE_COOKIES_CONTENT = [System.IO.File]::ReadAllText("$PWD/youtube_cookies.txt")
    }
}

if (-not $API_KEY) {
    Write-Host "Please set GEMINI_API_KEY environment variable or in .env file before deploying." -ForegroundColor Red
    exit 1
}

Write-Host "Setting GCP Project to $PROJECT_ID..."
gcloud.cmd config set project $PROJECT_ID

Write-Host "Enabling necessary GCP APIs..."
gcloud.cmd services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Build environment variables string
$ENV_VARS = "GEMINI_MODEL=$GEMINI_MODEL"
if ($RAPIDAPI_KEY) {
    $ENV_VARS += ",RAPIDAPI_KEY=$RAPIDAPI_KEY"
}
if ($RAPIDAPI_HOST) {
    $ENV_VARS += ",RAPIDAPI_HOST=$RAPIDAPI_HOST"
}
if ($YOUTUBE_PROXY) {
    $ENV_VARS += ",YOUTUBE_PROXY=$YOUTUBE_PROXY"
}
if ($WEBSHARE_PROXY_USERNAME) {
    $ENV_VARS += ",WEBSHARE_PROXY_USERNAME=$WEBSHARE_PROXY_USERNAME"
}
if ($WEBSHARE_PROXY_PASSWORD) {
    $ENV_VARS += ",WEBSHARE_PROXY_PASSWORD=$WEBSHARE_PROXY_PASSWORD"
}

# Ensure Secret Manager has latest GEMINI_API_KEY
if ($API_KEY) {
    Write-Host "Syncing GEMINI_API_KEY to GCP Secret Manager..."
    $API_KEY | gcloud.cmd secrets versions add GEMINI_API_KEY --data-file=- --quiet 2>$null
}

# Sync YouTube cookies to GCP Secret Manager if present
$SECRETS_PARAM = "GEMINI_API_KEY=GEMINI_API_KEY:latest"
if ($YOUTUBE_COOKIES_CONTENT) {
    Write-Host "Syncing YOUTUBE_COOKIES_CONTENT to GCP Secret Manager..." -ForegroundColor Cyan
    # Create secret if it doesn't exist
    gcloud.cmd secrets create YOUTUBE_COOKIES_CONTENT --replication-policy="automatic" --quiet 2>$null
    $YOUTUBE_COOKIES_CONTENT | gcloud.cmd secrets versions add YOUTUBE_COOKIES_CONTENT --data-file=- --quiet 2>$null
    $SECRETS_PARAM += ",YOUTUBE_COOKIES_CONTENT=YOUTUBE_COOKIES_CONTENT:latest"
}

Write-Host "Deploying $SERVICE_NAME to Cloud Run ($REGION)..."
gcloud.cmd run deploy $SERVICE_NAME --source . --region $REGION --platform managed --allow-unauthenticated --update-secrets "$SECRETS_PARAM" --update-env-vars "$ENV_VARS" --memory 512Mi --cpu 1 --min-instances 0 --max-instances 2 --quiet

Write-Host "Deployment completed! Getting service URL..."
gcloud.cmd run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
