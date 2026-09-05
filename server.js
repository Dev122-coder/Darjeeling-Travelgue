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
function buildTraveloguePrompt(notes, imageCount = 0) {
  const photoContext = imageCount > 1
    ? `You are provided with ${imageCount} journey photos. Look at the entire collection together—noticing the Toy Train, mountain scenery, mist, stations, tea gardens, architecture, or people across all photos, and weave these visible elements naturally into one cohesive memory.`
    : (imageCount === 1 
      ? `You are provided with a journey photo. Notice the visible scenery, atmosphere, colors, landscapes, train, or architecture.` 
      : ``);

  return `You are a creative travel writer specializing in Darjeeling and the Himalayan Toy Train.

Create a personal, evocative travel memory from the traveler's authentic notes and the uploaded photos.

${photoContext}

Write:
1. A short, beautiful travel-journal title
2. A 100-150 word personal travel story
3. A one-line memorable caption
4. 3-5 relevant hashtags

WRITING STYLE & GUIDELINES:
- Personal, warm, vivid, emotional, natural, elegant, and grounded.
- Deeply connected to the Darjeeling and Himalayan Toy Train journey: mountain mist, sharp whistle echoes, emerald tea garden terraces, pine slopes, wooden carriages, cold mountain air, and glimpses of Kanchenjunga.
- Use the traveler's notes as the primary source of truth for places, events, and personal experiences.
- Do NOT invent specific locations, landmarks, events, or historical facts that are not provided in the notes or visibly discernible in the photos.
- Avoid robotic AI phrases, travel clichés, and repetitive adjectives. Make it sound like an authentic personal travel journal entry.

Format exactly like:

TITLE:
[Short beautiful travel-journal title]

TRAVELOGUE:
[100–150 word personal travel story]

CAPTION:
[One memorable sentence]

HASHTAGS:
[3–5 relevant hashtags]

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

    // 2. Prepare and clean Base64 images for Ollama (Support all selected images up to 5)
    const cleanedImages = [];
    if (Array.isArray(images) && images.length > 0) {
      const limitedImages = images.slice(0, 5);
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
    const userPrompt = buildTraveloguePrompt(notes.trim(), cleanedImages.length);

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
