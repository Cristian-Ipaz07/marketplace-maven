// ============================================================
// background.js — MarketMaster SalesBot IA
// Maneja peticiones API (bypass CORS) y sincronización config
// ============================================================

// ── Modelos con fallback automático ──────────────────────────
const AI_MODELS = [
  {
    id: 'groq-llama-70b',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyField: 'groq_api_key',
    maxTokens: 350,
    temperature: 0.7
  },
  {
    id: 'groq-llama-8b',
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyField: 'groq_api_key',
    maxTokens: 350,
    temperature: 0.7
  },
  {
    id: 'openrouter-mistral',
    provider: 'openrouter',
    model: 'mistralai/mistral-7b-instruct:free',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyField: 'openrouter_api_key',
    maxTokens: 350,
    temperature: 0.7
  },
  {
    id: 'openrouter-gemma',
    provider: 'openrouter',
    model: 'google/gemma-2-9b-it:free',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyField: 'openrouter_api_key',
    maxTokens: 300,
    temperature: 0.7
  }
];

// ── Listener principal ────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SALESBOT_GET_AI') {
    handleAIRequest(request.messages, request.preferredModelId, sendResponse);
    return true;
  }

  if (request.action === 'SALESBOT_PING') {
    sendResponse({ alive: true, version: '1.0.0' });
    return false;
  }

  // Bridge: el dashboard web puede enviar config via postMessage → content script → background
  if (request.action === 'SALESBOT_SAVE_CONFIG') {
    // Config NO incluye API keys (quedan en storage.local, nunca salen)
    const { config } = request;
    chrome.storage.local.set({ salesbot_config: config }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'SALESBOT_GET_STATUS') {
    chrome.storage.local.get(['groq_api_key', 'openrouter_api_key', 'salesbot_config'], (data) => {
      sendResponse({
        hasGroqKey: !!(data.groq_api_key && data.groq_api_key.startsWith('gsk_')),
        hasOpenRouterKey: !!(data.openrouter_api_key && data.openrouter_api_key.length > 10),
        config: data.salesbot_config || null
      });
    });
    return true;
  }
});

// ── Núcleo: llamada IA con fallback en cascada ────────────────
async function handleAIRequest(messages, preferredModelId, sendResponse) {
  const storage = await getStorage(['groq_api_key', 'openrouter_api_key', 'salesbot_config']);

  // Ordenar: modelo preferido primero, luego el resto
  let modelQueue = [...AI_MODELS];
  if (preferredModelId) {
    modelQueue.sort((a, b) => (a.id === preferredModelId ? -1 : b.id === preferredModelId ? 1 : 0));
  }

  for (const model of modelQueue) {
    const apiKey = storage[model.keyField];
    if (!apiKey) continue; // Sin key para este proveedor, saltar

    try {
      const result = await callModel(model, apiKey, messages);
      if (result.success) {
        sendResponse({ success: true, text: result.text, modelUsed: model.id });
        return;
      }

      // Si es rate limit (429), esperar y probar siguiente
      if (result.status === 429) {
        console.warn(`[SalesBot] Rate limit en ${model.id}, probando siguiente...`);
        await sleep(800);
        continue;
      }

      // Error no recuperable, pasar al siguiente
      console.warn(`[SalesBot] Error en ${model.id}:`, result.error);

    } catch (err) {
      console.error(`[SalesBot] Excepción en ${model.id}:`, err);
    }
  }

  sendResponse({ success: false, error: 'Todos los modelos fallaron. Verifica tus API Keys.' });
}

async function callModel(model, apiKey, messages) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  // OpenRouter requiere headers adicionales
  if (model.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://marketmaster.app';
    headers['X-Title'] = 'MarketMaster SalesBot';
  }

  const response = await fetch(model.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model.model,
      messages,
      max_tokens: model.maxTokens,
      temperature: model.temperature
    })
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error?.message || `HTTP ${response.status}`, status: response.status };
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) return { success: false, error: 'Respuesta vacía del modelo' };

  return { success: true, text: text.trim() };
}

// ── Helpers ───────────────────────────────────────────────────
function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
