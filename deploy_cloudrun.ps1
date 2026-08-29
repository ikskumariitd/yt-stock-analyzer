# Automated Deployment Script for Google Cloud Run (Free Tier)
$PROJECT_ID = "stock-analyzer-ik2024"
$SERVICE_NAME = "alphapulse-stocks"
$REGION = "us-central1"
$API_KEY = $env:GEMINI_API_KEY

if (-not $API_KEY) {
    Write-Host "Please set GEMINI_API_KEY environment variable or in .env file before deploying." -ForegroundColor Red
    exit 1
}

Write-Host "Setting GCP Project to $PROJECT_ID..."
gcloud.cmd config set project $PROJECT_ID

Write-Host "Enabling APIs..."
gcloud.cmd services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

Write-Host "Deploying to Cloud Run..."
gcloud.cmd run deploy $SERVICE_NAME --source . --region $REGION --platform managed --allow-unauthenticated --set-env-vars "GEMINI_API_KEY=$API_KEY,GEMINI_MODEL=gemini-3.6-flash" --memory 512Mi --cpu 1 --min-instances 0 --max-instances 2 --quiet
