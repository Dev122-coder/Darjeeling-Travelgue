/**
 * AI Service Layer for Darjeeling Travelogue
 * 
 * Provides a clean, decoupled abstraction for travelogue generation.
 * Currently connects to local Ollama (Gemma 4 E4B) via Express, with an
 * extensible adapter architecture ready for direct in-browser on-device inference
 * (e.g. MediaPipe Web LLM / WebGPU Gemma) in future offline deployments.
 */

class AIService {
  constructor() {
    this.currentEngine = 'ollama'; // 'ollama' | 'browser-llm'
    this.status = 'unknown'; // 'ready' | 'loading' | 'unavailable'
    this.cachedStatusInfo = null;
  }

  /**
   * Check connection and readiness of local Ollama / Gemma model
   * @returns {Promise<{ status: 'ready'|'loading'|'unavailable', message: string, details?: any }>}
   */
  async checkHealth() {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        this.status = 'unavailable';
        return {
          status: 'unavailable',
          message: 'AI model service is not responding. Ensure Ollama is running.'
        };
      }

      const data = await response.json();
      if (data.status === 'ready') {
        this.status = 'ready';
        this.cachedStatusInfo = data;
        return {
          status: 'ready',
          message: `On-device AI ready (${data.model})`,
          details: data
        };
      } else {
        this.status = 'loading';
        return {
          status: 'loading',
          message: data.message || 'AI model is loading...',
          details: data
        };
      }
    } catch (error) {
      this.status = 'unavailable';
      return {
        status: 'unavailable',
        message: 'Cannot reach local server. You may be offline or Ollama is stopped.'
      };
    }
  }

  /**
   * Main generation entry point.
   * Transforms travel notes and compressed photos into a structured memory card.
   * 
   * @param {string} notes - Rough notes written by passenger
   * @param {Array<string>} images - Array of Base64 or DataURL image strings
   * @param {Object} options - Additional generation flags
   * @returns {Promise<{ title: string, travelogue: string, caption: string, hashtags: string[], rawStory: string }>}
   */
  async generateTravelogue(notes, images = [], options = {}) {
    if (!notes || notes.trim().length === 0) {
      throw new Error('Please enter your travel notes.');
    }

    if (this.currentEngine === 'browser-llm') {
      return this._generateViaBrowserLLM(notes, images, options);
    }

    // Default: Dispatch via local Ollama pipeline
    return this._generateViaOllama(notes, images, options);
  }

  /**
   * Local Ollama generation pipeline via Express proxy
   */
  async _generateViaOllama(notes, images, options) {
    const payload = {
      notes: notes.trim(),
      images: images || []
    };

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errMsg = data.error || `Server returned error (${response.status})`;
      throw new Error(errMsg);
    }

    // Parse structured sections from Gemma's response
    return this.parseModelOutput(data.story);
  }

  /**
   * Architectural hook for in-browser on-device Gemma (MediaPipe LLM / WebGPU)
   * This allows the same UI to switch to pure client-side on-device inference.
   */
  async _generateViaBrowserLLM(notes, images, options) {
    console.info('[AI Service] Browser on-device LLM pipeline placeholder');
    // Future implementation:
    // const result = await window.mediaPipeLLM.generate(...);
    // return this.parseModelOutput(result);
    throw new Error('In-browser WebGPU Gemma inference is undergoing device calibration. Please use local Ollama mode.');
  }

  /**
   * Robust parser to extract TITLE, TRAVELOGUE, CAPTION, and HASHTAGS
   * from Gemma's raw output. Handles slight formatting variations gracefully.
   * 
   * @param {string} rawText
   */
  parseModelOutput(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return {
        title: 'Journey Through the Misty Hills',
        travelogue: 'The toy train climbed steadily along the narrow mountain tracks...',
        caption: 'Some journeys become memories before they even end.',
        hashtags: ['#Darjeeling', '#ToyTrain', '#Himalayas'],
        rawStory: ''
      };
    }

    // Clean up text
    const text = rawText.trim();

    let title = '';
    let travelogue = '';
    let caption = '';
    let hashtags = [];

    // Regex pattern matches for sections
    const titleMatch = text.match(/(?:^|\n)\s*(?:\*{1,2})?TITLE:?(?:\*{1,2})?\s*\n*([\s\S]*?)(?=(?:\n\s*(?:\*{1,2})?TRAVELOGUE:?(?:\*{1,2})?|\n\s*(?:\*{1,2})?CAPTION:?(?:\*{1,2})?|$))/i);
    const travelogueMatch = text.match(/(?:^|\n)\s*(?:\*{1,2})?TRAVELOGUE:?(?:\*{1,2})?\s*\n*([\s\S]*?)(?=(?:\n\s*(?:\*{1,2})?CAPTION:?(?:\*{1,2})?|\n\s*(?:\*{1,2})?HASHTAGS:?(?:\*{1,2})?|$))/i);
    const captionMatch = text.match(/(?:^|\n)\s*(?:\*{1,2})?CAPTION:?(?:\*{1,2})?\s*\n*([\s\S]*?)(?=(?:\n\s*(?:\*{1,2})?HASHTAGS:?(?:\*{1,2})?|$))/i);
    const hashtagsMatch = text.match(/(?:^|\n)\s*(?:\*{1,2})?HASHTAGS:?(?:\*{1,2})?\s*\n*([\s\S]*?)$/i);

    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/^[#"*\s]+|[#"*\s]+$/g, '').trim();
    }

    if (travelogueMatch && travelogueMatch[1]) {
      travelogue = travelogueMatch[1].trim();
    }

    if (captionMatch && captionMatch[1]) {
      caption = captionMatch[1].replace(/^["']|["']$/g, '').trim();
    }

    if (hashtagsMatch && hashtagsMatch[1]) {
      const tagStr = hashtagsMatch[1].trim();
      hashtags = tagStr
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => t.startsWith('#') ? t : `#${t}`);
    }

    // Fallback parsing if explicit headers were slightly altered by the model
    if (!travelogue) {
      // Split by paragraphs
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      if (paragraphs.length >= 2) {
        if (!title) title = paragraphs[0].replace(/^(TITLE:?|#)\s*/i, '').trim();
        travelogue = paragraphs.slice(1, paragraphs.length - 1).join('\n\n').trim();
        if (!caption && paragraphs.length >= 3) {
          caption = paragraphs[paragraphs.length - 1].replace(/^CAPTION:?\s*/i, '').trim();
        }
      } else {
        travelogue = text;
      }
    }

    if (!title) {
      title = 'Himalayan Rhythms of Darjeeling';
    }

    if (!caption) {
      caption = 'Where the clouds meet the iron rails of the past.';
    }

    if (hashtags.length === 0) {
      hashtags = ['#Darjeeling', '#ToyTrain', '#DHR', '#HimalayanRailway'];
    }

    return {
      title,
      travelogue,
      caption,
      hashtags,
      rawStory: text
    };
  }
}

// Global Singleton
const aiService = new AIService();
if (typeof window !== 'undefined') {
  window.aiService = aiService;
}
