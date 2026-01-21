#!/bin/bash

# Development Build Setup Script for GamerHive
# This script helps set up a development build for push notifications

echo "🚀 GamerHive Development Build Setup"
echo "======================================"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g eas-cli
    echo "✅ EAS CLI installed"
else
    echo "✅ EAS CLI is installed"
    eas --version
fi

echo ""
echo "📋 Next Steps:"
echo "1. Login to Expo: eas login"
echo "2. Initialize EAS: eas init"
echo "3. Build development client:"
echo "   - Android: eas build --profile development --platform android"
echo "   - iOS: eas build --profile development --platform ios"
echo ""
echo "📖 For detailed instructions, see: DEVELOPMENT_BUILD_SETUP.md"
echo ""

