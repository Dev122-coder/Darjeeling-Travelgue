const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e4b';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Health Check Endpoint
 * Checks whether Ollama is reachable and whether gemma4:e4b is available
 */
app.get('/api/health', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const [verRes, tagsRes] = await Promise.all([
      fetch(`${OLLAMA_HOST}/api/version`, { signal: controller.signal }).catch(() => null),
      fetch(`${OLLAMA_HOST}/api/tags`, { signal: controller.signal }).catch(() => null)
    ]);
    clearTimeout(timeout);

    if (!verRes || !verRes.ok) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Ollama service is not responding at ' + OLLAMA_HOST,
        model: OLLAMA_MODEL
      });
    }

    const verData = await verRes.json();
    let hasModel = false;
    let availableModels = [];

    if (tagsRes && tagsRes.ok) {
      const tagsData = await tagsRes.json();
      availableModels = (tagsData.models || []).map(m => m.name);
      hasModel = availableModels.some(m => m.includes('gemma4') || m === OLLAMA_MODEL);
    }

    res.json({
      status: 'ready',
      version: verData.version,
      model: OLLAMA_MODEL,
      modelAvailable: hasModel,
      availableModels
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Failed to connect to Ollama: ' + error.message
    });
  }
});

/**
 * Prompt Builder
 * Conforms strictly to the hackathon specification
 */
function buildTraveloguePrompt(notes) {
  return `You are a creative travel writer specializing in Darjeeling and Himalayan railway journeys.

Create a beautiful, personal travel memory from the traveler's notes and uploaded photo.

Write:
1. A short poetic title
2. A 100-150 word travelogue
3. A one-line memorable caption
4. 3-5 relevant hashtags

Use the photo to notice scenery, atmosphere, colors, landscapes, trains, architecture, people, or other visible details.

Use the traveler's notes as the source of truth for places and events.

Do not invent specific facts that are not provided or visible.

Make the writing warm, vivid, emotional, natural and personal.

Make it feel like a real passenger's memory.

Format exactly like:

TITLE:
[title]

TRAVELOGUE:
[travelogue]

CAPTION:
[caption]

HASHTAGS:
[hashtags]

Travel notes:
${notes}`;
}

/**
 * Main Travelogue Generation Handler
 */
async function handleGeneration(req, res) {
  try {
    const { notes, images } = req.body;

    // 1. Validation
    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide your travel notes before generating the travelogue.'
      });
    }

    if (notes.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Travel notes exceed 5000 characters limit. Please shorten your notes.'
      });
    }

    // 2. Prepare and clean Base64 images for Ollama
    const cleanedImages = [];
    if (Array.isArray(images) && images.length > 0) {
      // Limit to 3 images to conserve RAM on 8GB machine
      const limitedImages = images.slice(0, 3);
      for (const img of limitedImages) {
        if (typeof img === 'string') {
          // Strip data:image/...;base64, prefix if present
          const base64Data = img.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
          if (base64Data.length > 0) {
            cleanedImages.push(base64Data);
          }
        }
      }
    }

    console.log(`[Travelogue] Generating memory for note length ${notes.length}, images: ${cleanedImages.length}`);

    // 3. Build Prompt & Ollama payload
    const userPrompt = buildTraveloguePrompt(notes.trim());

    const messagePayload = {
      role: 'user',
      content: userPrompt
    };

    if (cleanedImages.length > 0) {
      messagePayload.images = cleanedImages;
    }

    const ollamaRequestBody = {
      model: OLLAMA_MODEL,
      messages: [messagePayload],
      stream: false,
      think: false, // Turn off thinking for fast, clean creative output
      options: {
        temperature: 0.7,
        num_predict: 250
      }
    };

    // 4. Send request to Ollama
    const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ollamaRequestBody)
    });

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text();
      console.error('[Ollama Error]', ollamaResponse.status, errText);
      return res.status(ollamaResponse.status).json({
        success: false,
        error: `Ollama error (${ollamaResponse.status}): ${errText || 'Failed to generate response'}`
      });
    }

    const data = await ollamaResponse.json();
    const rawContent = data.message?.content || '';

    if (!rawContent) {
      return res.status(502).json({
        success: false,
        error: 'Received empty response from Gemma model.'
      });
    }

    console.log('[Travelogue] Generation successful!');

    res.json({
      success: true,
      story: rawContent,
      model: OLLAMA_MODEL,
      created_at: data.created_at || new Date().toISOString()
    });

  } catch (error) {
    console.error('[Generation Exception]', error);

    if (error.code === 'ECONNREFUSED' || (error.cause && error.cause.code === 'ECONNREFUSED')) {
      return res.status(503).json({
        success: false,
        error: 'Ollama is not running locally. Please run "ollama serve" and verify model "gemma4:e4b" is installed.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred: ' + (error.message || 'Unknown server error')
    });
  }
}

// Bind both routes (/generate and /api/generate) for flexibility
app.post('/api/generate', handleGeneration);
app.post('/generate', handleGeneration);

// Fallback for SPA/PWA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server with Graceful Port Fallback
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`====================================================`);
    console.log(`🚂 Darjeeling Travelogue Server running on port ${portToTry}`);
    console.log(`🌐 Local URL: http://localhost:${portToTry}`);
    console.log(`🤖 Connected to Ollama: ${OLLAMA_HOST} (${OLLAMA_MODEL})`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${portToTry} is already in use. Trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('[Server Error]', err);
    }
  });
}

startServer(Number(PORT));
