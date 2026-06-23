---
name: Mi Bodega OCR and tab layout
description: Key decisions for the Mi Bodega wine journal app regarding free OCR and tab navigation.
---

# OCR setup
- Uses OCR.space free API with key "helloworld" (500 req/day, no signup, 1MB image limit)
- Expo app compresses images to quality 0.7 before base64 encoding
- `express.json({ limit: "10mb" })` required in app.ts to accept base64 payloads
- `parseWineFields()` runs on the API server (src/routes/ocr.ts) using regex patterns for Spanish/international wine labels

**Why:** Free, no API key needed from user, no external library overhead on mobile.

**How to apply:** If user wants more OCR requests, direct them to get a free key at ocr.space and add it as an env var.

# Tab layout
- Uses classic `Tabs` from expo-router (NOT NativeTabs/LiquidGlass unstable APIs)
- NativeTabs import from `expo-router/unstable-native-tabs` caused blank screen on web

**Why:** The unstable NativeTabs API caused bundling issues (blank screen) in web preview. Classic Tabs is stable across all platforms.

**How to apply:** For this project, always use classic Tabs unless specifically testing iOS 26 native behavior.
