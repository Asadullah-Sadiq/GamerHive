# Development Build Setup Script for GamerHive (PowerShell)
# This script helps set up a development build for push notifications

Write-Host "🚀 GamerHive Development Build Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if EAS CLI is installed
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue

if (-not $easInstalled) {
    Write-Host "❌ EAS CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g eas-cli
    Write-Host "✅ EAS CLI installed" -ForegroundColor Green
} else {
    Write-Host "✅ EAS CLI is installed" -ForegroundColor Green
    eas --version
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Login to Expo: eas login"
Write-Host "2. Initialize EAS: eas init"
Write-Host "3. Build development client:"
Write-Host "   - Android: eas build --profile development --platform android"
Write-Host "   - iOS: eas build --profile development --platform ios"
Write-Host ""
Write-Host "📖 For detailed instructions, see: DEVELOPMENT_BUILD_SETUP.md" -ForegroundColor Yellow
Write-Host ""

