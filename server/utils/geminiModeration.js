/**
 * Gemini API Content Moderation
 * Uses Google Gemini 3 Flash Preview model for content classification
 */

const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Classify text content using Gemini API
 * @param {string} text - The text to classify
 * @returns {Promise<{category: string, isSafe: boolean, isHarmful: boolean, isMildInsult: boolean}>}
 */
async function classifyContent(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      category: 'SAFE',
      isSafe: true,
      isHarmful: false,
      isMildInsult: false,
    };
  }

  if (!GEMINI_API_KEY) {
    console.warn('[Gemini Moderation] ⚠️  GEMINI_API_KEY not set, allowing message');
    return {
      category: 'SAFE',
      isSafe: true,
      isHarmful: false,
      isMildInsult: false,
      error: 'API key not configured',
    };
  }

  try {
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Classify the following text into ONE category only:\n\nCATEGORIES:\n1) SAFE\n2) MILD_INSULT (allowed, no deletion)\n3) HARMFUL (delete immediately)\n\nText:\n"${text}"\n\nRules:\n- Mild insults without threats = MILD_INSULT\n- No morality explanation\n- Output ONLY the category name, if it is sexual it should be delete`,
            },
          ],
        },
      ],
    };

    const response = await axios.post(GEMINI_API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });

    // Extract the category from the response
    const categoryText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'SAFE';
    
    // Normalize the category (handle variations)
    let category = 'SAFE';
    const upperText = categoryText.toUpperCase();
    
    if (upperText.includes('HARMFUL')) {
      category = 'HARMFUL';
    } else if (upperText.includes('MILD_INSULT') || upperText.includes('MILD')) {
      category = 'MILD_INSULT';
    } else {
      category = 'SAFE';
    }

    console.log('[Gemini Moderation] Classification result:', {
      text: text.substring(0, 50) + '...',
      category: category,
      rawResponse: categoryText,
    });

    return {
      category: category,
      isSafe: category === 'SAFE',
      isHarmful: category === 'HARMFUL',
      isMildInsult: category === 'MILD_INSULT',
    };
  } catch (error) {
    console.error('[Gemini Moderation] ❌ Error calling Gemini API:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // On error, default to safe (allow message) but log it
    return {
      category: 'SAFE',
      isSafe: true,
      isHarmful: false,
      isMildInsult: false,
      error: error.message,
    };
  }
}

module.exports = {
  classifyContent,
};

