# 🚂 Darjeeling Travelogue

> **Transform your rough Toy Train journey notes and photos into an evocative Himalayan travelogue using on-device Gemma AI.**  
> Built for the **GDG Siliguri "Code for Communities: Toy Train Edition"** hackathon in collaboration with the **Darjeeling Himalayan Railway (DHR)**.

---

## 🏔️ Project Overview

### The Problem
Millions of travelers ride the UNESCO World Heritage **Darjeeling Himalayan Railway (DHR)** between New Jalpaiguri, Kurseong, Ghum, and Darjeeling. Along the way, passengers capture fleeting impressions: snapshots of mist rolling over tea gardens, engine steam billowing at the Batasia Loop spiral, the aroma of cardamom chai, and handwritten diary fragments. However, these raw memories usually stay trapped in photo galleries and scattered notes, rarely transforming into a coherent, poetic travelogue or keepsake.

### The Solution
**Darjeeling Travelogue** is an on-device AI-powered memory crafter and souvenir postcard generator. Passengers enter rough travel notes and upload journey photos. The application uses **Google Gemma 4 E4B** (running locally via Ollama) to:
1. Extract visual context (mist, railway tracks, architecture, tea slopes, colors) from uploaded images.
2. Ground the narrative strictly in the traveler’s authentic notes as the source of truth (preventing AI hallucinations).
3. Produce a structured vintage travelogue:
   - **Poetic Title**
   - **100–150 Word Travelogue Narrative**
   - **One-Line Memorable Caption**
   - **Relevant Hashtags**
4. Render the output into a downloadable, high-resolution souvenir postal card that can be copied, shared, or printed.

---

## 💡 Key Features

- **Heritage Toy Train Aesthetic**: Warm parchment backgrounds, British-Indian railway green (`#1B3B2B`), terracotta station tones, perforated vintage postage stamps, and locomotive steam animations.
- **Client-Side Image Optimization**: Automatically resizes and compresses photos in-browser (max 1024px WebP/JPEG, quality 0.82) to run smoothly on laptops with ~8 GB RAM without memory exhaustion.
- **Strict Grounding & Zero Hallucinations**: Prompt instructions instruct Gemma to honor passenger notes as the ground truth while observing scenery details from photos.
- **PWA & Offline Capability**:
  - Full `manifest.json` and `service-worker.js` caching.
  - Installable on desktop and mobile devices.
  - Static app shell remains 100% accessible offline without internet connection.
- **Live AI Status Indicator**:
  - `🟢 On-device AI ready` (Ollama & Gemma online)
  - `🟡 AI model loading...`
  - `🔴 AI model unavailable` (graceful recovery instructions)
- **1-Click Judge Journey Presets**:
  - 🌀 *Batasia Loop Sunrise*
  - 🌧️ *Ghum Station Whistle*
  - 🍵 *Happy Valley Tea Mist*
- **Export & Share**:
  - 📋 **Copy Story**: Formatted markdown/plain text for journaling.
  - 📤 **Web Share**: Native OS share sheet (mobile/desktop) with automatic clipboard fallback.
  - 💾 **Download Card**: 100% client-side HTML5 Canvas souvenir postcard generator exporting a crisp PNG.

---

## 🏗️ Architecture: Development vs. Final Target

```
[Development / Current Architecture]
Browser (PWA UI)
   ↓ (Compressed Base64 + Notes)
Express.js Server (localhost:3000 / 3001)
   ↓ (POST /api/chat with think: false)
Local Ollama Service (http://localhost:11434)
   ↓
Gemma 4 E4B Model (On-Device Vision + LLM)
   ↓ (Structured Title, Story, Caption, Tags)
Browser Postcard Display
```

```
[Target Production Architecture (Zero Server)]
Browser (PWA UI)
   ↓ (WebGPU / MediaPipe LLM Inference Web SDK)
On-Device Gemma Model (In-Browser Cache / Origin Private File System)
   ↓
Pure Client-Side Postcard Display (100% Offline, No Localhost / Server Required)
```

> **Design Decoupling**: The frontend AI service (`public/js/ai-service.js`) encapsulates generation behind `generateTravelogue(notes, images, options)`. Moving to in-browser WebGPU/MediaPipe in future releases requires zero changes to the UI layer.

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, Modern Vanilla CSS3, ES6 JavaScript | Lightweight, accessible, zero framework bloat |
| **Application Layer** | Node.js, Express.js | Static asset serving, JSON payload handling (50MB limit) |
| **Local AI Engine** | Ollama (`v0.33.3+`) | Local model runner & OpenAI-compatible chat API |
| **Model** | `gemma4:e4b` | Google Gemma 4 on-device multimodal model |
| **PWA & Offline** | Web App Manifest, Service Worker | Offline asset caching, installable home-screen app |
| **Graphics & Export** | Native HTML5 Canvas 2D | High-resolution souvenir postcard PNG generation |

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (Tested on Node v24)
- **Ollama**: Installed locally from [ollama.com](https://ollama.com)
- **Hardware Minimum**: Tested on standard laptop with **8 GB RAM**

### 2. Pull the Gemma 4 Model
In your terminal, pull and verify `gemma4:e4b`:
```bash
ollama pull gemma4:e4b
```
Verify the model is installed:
```bash
ollama list
```

### 3. Install Dependencies
Open a terminal in the project directory:
```bash
npm install
```
*(On Windows PowerShell with script execution policies, run `npm.cmd install`)*

### 4. Start the Application
```bash
node server.js
```
The server will output:
```
====================================================
🚂 Darjeeling Travelogue Server running on port 3000
🌐 Local URL: http://localhost:3000
🤖 Connected to Ollama: http://localhost:11434 (gemma4:e4b)
====================================================
```
*(If port 3000 is occupied by another process, `server.js` automatically binds to port 3001).*

### 5. Open in Browser
Navigate to:
```
http://localhost:3000
```
*(or `http://localhost:3001` if port 3000 was in use).*

---

## 🧪 Testing Guide for Hackathon Judges

### 1. Instant 1-Click Demo
1. Open the web app.
2. Click any preset pill under **"⚡ Try a Journey Preset"**:
   - Click **"🌀 Batasia Loop Sunrise"**
   - Click **"✨ Generate Travelogue"**
3. Watch the steam locomotive progress indicator.
4. Review the generated souvenir postcard with title, poetic story, quote, and tags!

### 2. Testing Your Own Notes & Photos
1. Type custom notes in the textarea (e.g., *"Standing on the open footboard at Tindharia. Dense fog everywhere. The cold wind brought smell of wet coal and pine cones."*).
2. Drag and drop any `.jpg`, `.png`, or `.webp` photo into the drop zone.
3. Notice the thumbnail preview with the `AI Vision` badge (images are resized in browser to max 1024px).
4. Click **"✨ Generate Travelogue"**.
5. Test:
   - Click **"📋 Copy Story"** to verify clipboard text.
   - Click **"📤 Share"** to trigger the Web Share API.
   - Click **"💾 Download Card"** to export the high-res PNG postcard.

### 3. Testing Offline Resilience
1. Open Chrome DevTools (`F12` or `Ctrl+Shift+I`).
2. Go to the **Application** tab -> **Service Workers** -> verify registered.
3. Go to the **Network** tab -> Check **Offline**.
4. Refresh the page:
   - Notice the entire UI loads instantly from cache.
   - The top banner displays: `📡 Offline Mode Active: Static assets cached`.
   - The status pill updates to: `🔴 Offline`.

### 4. Testing AI Model Unavailable State
1. Temporarily stop the Ollama service (`ollama stop` or terminate process).
2. The UI status pill turns yellow/red: `🔴 AI model unavailable`.
3. If a generation is attempted, the app displays a non-crashing, friendly alert explaining how to resume Ollama (`ollama serve`).

---

## 🏆 Hackathon Judging Criteria Alignment

| Judging Criteria | Implementation in Darjeeling Travelogue |
| :--- | :--- |
| **1. Works Offline** | Full PWA implementation (`manifest.json`, `service-worker.js`). Static shell cached for instant offline launch. Client-side image compression and canvas postcard generation require zero cloud services. |
| **2. Usefulness to the Hills** | Designed specifically for passengers and tourists on the Darjeeling Himalayan Railway (DHR). Preserves intangible Himalayan heritage, station stories (Ghum, Kurseong, Batasia), and local cultural experiences. |
| **3. On-Device AI** | Uses local `gemma4:e4b` through Ollama with `think: false` for efficient edge inference. Architecture is structured for direct in-browser WebGPU/MediaPipe execution. |
| **4. Craft & Quality** | Bespoke typography, responsive layout, accessible contrast, thoughtful error states, client-side memory safety, and high-res postal export without external library dependencies. |
| **5. Local Context & Belonging** | Rich integration of DHR heritage: Batasia Loop spirals, Ghum altitude (2,258m), UNESCO World Heritage dispatch seal, B-Class steam engine silhouettes, and authentic tea garden references. |

---

## 🔒 Security & Performance Considerations

- **Memory Management on ~8 GB RAM**: Images are pre-scaled on an HTML5 canvas to a maximum dimension of 1024px and compressed before Base64 encoding. Object URLs are cleaned via `URL.revokeObjectURL()`. Payload is capped at 3 photos for Ollama to prevent out-of-memory errors.
- **XSS Prevention**: AI generated text is rendered using `textContent` and safe DOM elements, never using raw `innerHTML`.
- **Latency**: `think: false` and `num_predict: 250` ensure fast, poetic generation tailored for hackathon demos.

---

## 📜 License
Created under the MIT License for the GDG Siliguri Hackathon 2026.
