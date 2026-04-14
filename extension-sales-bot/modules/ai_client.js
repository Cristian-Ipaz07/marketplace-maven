// ============================================================
// modules/ai_client.js — Cliente IA Pro para SalesBot
// v2.0: Inventory lookup + Cross-selling + Context Sync
// ============================================================

window.SalesBotAI = (() => {

  // ── Cache de inventario (evita consultas repetidas) ───────
  let _inventoryCache = null;
  let _inventoryCacheTs = 0;
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

  // ── Supabase credentials (desde config sincronizada) ─────
  const SUPABASE_FALLBACK_URL  = 'https://YOUR_PROJECT.supabase.co'; // se sobreescribe con config
  const SUPABASE_FALLBACK_KEY  = '';

  // ── Consulta inventario desde Supabase ───────────────────
  async function fetchInventory(config) {
    const now = Date.now();
    if (_inventoryCache && (now - _inventoryCacheTs) < CACHE_TTL_MS) {
      return _inventoryCache;
    }

    const supabaseUrl  = config?.supabase_url  || SUPABASE_FALLBACK_URL;
    const supabaseKey  = config?.supabase_anon_key || SUPABASE_FALLBACK_KEY;

    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_PROJECT')) {
      console.warn('[SalesBot AI] Supabase URL/Key no configurado, omitiendo lookup de inventario.');
      return [];
    }

    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/products?select=id,title,short_name,price,description,tags,category&order=title`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!res.ok) {
        console.warn('[SalesBot AI] Error consultando inventario:', res.status);
        return [];
      }
      const data = await res.json();
      _inventoryCache = data || [];
      _inventoryCacheTs = now;
      console.log(`[SalesBot AI] Inventario cargado: ${_inventoryCache.length} productos`);
      return _inventoryCache;
    } catch (e) {
      console.error('[SalesBot AI] Error fetch inventario:', e);
      return [];
    }
  }

  // ── Busca producto por nombre en el inventario ────────────
  function findMatchingProduct(detectedProductName, inventory) {
    if (!detectedProductName || !inventory?.length) return null;

    const needle = detectedProductName.toLowerCase().trim();

    // 1. Match exacto en short_name
    let match = inventory.find(p =>
      p.short_name && p.short_name.toLowerCase() === needle
    );
    if (match) return match;

    // 2. Match exacto en title
    match = inventory.find(p => p.title.toLowerCase() === needle);
    if (match) return match;

    // 3. Match parcial: el nombre detectado contiene palabras del producto
    match = inventory.find(p => {
      const titleWords = p.title.toLowerCase().split(/\s+/);
      return titleWords.some(w => w.length > 3 && needle.includes(w));
    });
    if (match) return match;

    // 4. Match por tags
    match = inventory.find(p => {
      if (!p.tags) return false;
      const tags = p.tags.toLowerCase().split(/,\s*/);
      return tags.some(t => needle.includes(t) || t.includes(needle));
    });

    return match || null;
  }

  // ── Obtiene 3 productos de venta cruzada ──────────────────
  function getCrossSellProducts(matchedProduct, inventory, maxCount = 3) {
    if (!inventory?.length) return [];

    const exclude = matchedProduct?.id;

    // Filtrar el producto actual y los de la misma categoría o diferente
    let candidates = inventory.filter(p => p.id !== exclude);

    // Priorizar productos de distinta categoría para verdadero upsell
    const diffCategory = candidates.filter(p =>
      matchedProduct ? p.category !== matchedProduct.category : true
    );

    const pool = diffCategory.length >= maxCount ? diffCategory : candidates;

    // Mezcla aleatoria reproducible (seed por nombre de producto)
    pool.sort(() => 0.5 - Math.random());
    return pool.slice(0, maxCount);
  }

  // ── Construye el system prompt completo ──────────────────
  function buildSystemPrompt(config, context, matchedProduct, crossSellProducts, history = []) {
    const business     = config?.business_name        || 'mi negocio';
    const description  = config?.business_description || '';
    const tone         = config?.tone                 || 'friendly';
    const customRules  = config?.custom_rules         || '';
    const priceRange   = config?.price_range          || '';
    const products     = config?.products             || [];

    const TONE_MAP = {
      friendly:     'Sé amigable y muy natural, como un humano real chateando por WhatsApp. Respuestas breves al grano. Máximo 1 emoji.',
      professional: 'Mantén un tono profesional, claro y directo. Sin emojis. Cero rodeos.',
      urgent:       'Sé persuasivo pero sutil. Menciona alta demanda solo si el cliente duda. Cero presión exagerada. Máximo 1 emoji.',
      spiritual:    'Tono muy tranquilo, calmado y empático. Sin presión comercial.'
    };

    // ── Bloque 1: Identity ───────────────────────────────
    let prompt = `Eres el asistente de ventas de "${business}".`;
    if (description) prompt += `\n\n**Sobre el negocio:** ${description}`;

    // ── Bloque 2: Catálogo general del Dashboard ─────────
    if (products.length) {
      prompt += `\n\n**Líneas de producto del negocio:** ${products.join(', ')}`;
    }
    if (priceRange) {
      prompt += `\n**Rango de precios general:** ${priceRange}`;
    }

    // ── Bloque 3: Producto específico detectado en el chat ─
    if (matchedProduct) {
      prompt += `\n\n--- PRODUCTO ACTIVO EN ESTA CONVERSACIÓN ---`;
      prompt += `\n**Nombre:** ${matchedProduct.title}`;
      if (matchedProduct.short_name) prompt += ` / ${matchedProduct.short_name}`;
      prompt += `\n**Precio real:** $${matchedProduct.price}`;
      if (matchedProduct.description) prompt += `\n**Descripción oficial:** ${matchedProduct.description}`;
      if (matchedProduct.tags) prompt += `\n**Etiquetas/Características:** ${matchedProduct.tags}`;
      if (matchedProduct.category) prompt += `\n**Categoría:** ${matchedProduct.category}`;
      prompt += `\n--- FIN PRODUCTO ACTIVO ---`;
    } else if (context?.product) {
      // Fallback: solo tenemos el nombre detectado por DOM, sin match de inventario
      prompt += `\n\n**Producto en conversación (detectado):** ${context.product}`;
      if (context?.price) prompt += `\n**Precio visto en publicación:** ${context.price}`;
    }

    // ── Bloque 4: Contexto del cliente ───────────────────
    if (context?.clientName) {
      prompt += `\n\n**Nombre del cliente:** ${context.clientName} (úsalo para personalizar)`;
    }

    // ── Bloque 5: Tono y personalidad ────────────────────
    prompt += `\n\n**Tono de ventas:** ${TONE_MAP[tone] || TONE_MAP.friendly}`;

    // ── Bloque 6: Reglas personalizadas del Dashboard ────
    if (customRules) {
      prompt += `\n\n**Reglas personalizadas (sigue SIEMPRE):**\n${customRules}`;
    }

    const isFirstMessage = history.length <= 1; // Solo está el mensaje inicial (o ninguno)

    // ── Bloque 7: Sugerencias de venta cruzada ───────────
    if (crossSellProducts?.length && !isFirstMessage) {
      prompt += `\n\n**Productos disponibles para venta cruzada / upsell (sugerir sutilmente si es oportuno):**`;
      crossSellProducts.forEach((p, i) => {
        prompt += `\n${i + 1}. ${p.short_name || p.title} — $${p.price}`;
        if (p.description) prompt += ` — ${p.description.slice(0, 60)}...`;
      });
    }

    // ── Bloque 8: Regla anti-alucinación y prudencia espacial ──
    prompt += `\n\n**REGLAS ESTRICTAS E INQUEBRANTABLES (CUMPLIR AL 100%):**
1. HUMANIDAD Y BREVEDAD: Habla como un humano ocupado texteando desde su celular. NUNCA des respuestas largas tipo "email" ni parezcas un robot vendedor desesperado. MÁXIMO 2 líneas de texto.
2. CERO ALUCINACIÓN DE LUGARES O HECHOS: Si el cliente menciona una ciudad (Ej: "estoy en Ipiales"), NO inventes que está en otra ciudad (Ej: "entiendo que estás en Ibagué"). Lee cuidadosamente. Si no sabes algo, di "Déjame confirmar eso."
3. NO PRESIONES: No fuerces el cierre de venta inmediatamente. Sortea la duda del cliente con amabilidad. No ofrezcas domicilio nacional o local a menos que sea la única opción natural.
4. DIRECCIÓN: NUNCA des la dirección física exacta de la tienda ("Mz G3...", "estamos en X cuadra...") a menos que pregunten "¿dónde están ubicados?".`;

    // ── Bloque 9: Detección de primer mensaje ─────────────────
    if (isFirstMessage) {
      prompt += `\n\n**ESTADO DEL CHAT: PRIMER MENSAJE**
- SOLO saluda cortésmente (nunca digas "qué gusto verte de nuevo", porque no lo conoces).
- Confirma que el producto SÍ está disponible.
- Haz SOLO UNA pregunta sencilla para iniciar la charla (Ejemplo: "¿En qué talla lo estás buscando?" o "¿De qué ciudad nos escribes?").
- NUNCA ofrezcas la dirección del local ni presiones a comprar inmediatamente.
- Tu respuesta DEBE ser súper corta: máximo 2 oraciones. NO te extiendas.`;
    }

    // ── Bloque 10: Directiva final ─────────────────────────
    prompt += `\n\n**FORMATO DE RESPUESTA:** Responde SOLO el mensaje final que se enviará al cliente. Sin comillas. Sin prefijos como "Bot:" o "Respuesta:". Sé natural y conciso, evita sonar hostigante o ansioso por vender.`;

    return prompt;
  }

  // ── Genera respuesta IA (flujo completo) ─────────────────
  async function generateResponse({ history = [], customPrompt = '', context = {}, config = {} }) {

    // 1. Obtener inventario de Supabase
    const inventory = await fetchInventory(config);

    // 2. Buscar producto que coincida con el detectado en el DOM
    const matchedProduct = findMatchingProduct(context?.product, inventory);
    if (matchedProduct) {
      console.log(`[SalesBot AI] Producto matcheado: ${matchedProduct.title} ($${matchedProduct.price})`);
    }

    // 3. Generar sugerencias de cross-sell
    const crossSellProducts = getCrossSellProducts(matchedProduct, inventory);

    // 4. Construir system prompt enriquecido
    const systemPrompt = buildSystemPrompt(config, context, matchedProduct, crossSellProducts, history);
    const preferredModelId = config?.preferred_model || null;

    // 5. Armar mensajes en formato OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // últimos 10 mensajes del scanner
    ];

    if (customPrompt.trim()) {
      messages.push({ role: 'user', content: customPrompt.trim() });
    }

    // 6. Enviar al background worker (evita CORS)
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'SALESBOT_GET_AI', messages, preferredModelId },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: 'No se pudo conectar con el background: ' + chrome.runtime.lastError.message });
              return;
            }
            resolve(response || { success: false, error: 'Sin respuesta del worker' });
          }
        );
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  }

  // ── Config: carga desde chrome.storage.local ─────────────
  async function loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['salesbot_config', 'groq_api_key', 'openrouter_api_key'],
        (data) => {
          const cfg = data.salesbot_config || {};
          resolve({
            ...cfg,
            groq_api_key: data.groq_api_key,
            openrouter_api_key: data.openrouter_api_key,
            // Supabase creds vienen dentro de salesbot_config (sincronizadas desde Dashboard)
            supabase_url: cfg.supabase_url || '',
            supabase_anon_key: cfg.supabase_anon_key || '',
          });
        }
      );
    });
  }

  // ── Config: guarda en chrome.storage.local ────────────────
  async function saveConfig(partialConfig) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['salesbot_config', 'groq_api_key', 'openrouter_api_key'], (data) => {
        const updates = {};
        const configUpdates = { ...(data.salesbot_config || {}) };

        for (const [key, value] of Object.entries(partialConfig)) {
          if (key === 'groq_api_key' || key === 'openrouter_api_key') {
            updates[key] = value;
          } else {
            configUpdates[key] = value;
          }
        }

        updates.salesbot_config = configUpdates;
        chrome.storage.local.set(updates, resolve);
      });
    });
  }

  // ── Invalida cache de inventario manualmente ──────────────
  function clearInventoryCache() {
    _inventoryCache = null;
    _inventoryCacheTs = 0;
    console.log('[SalesBot AI] Cache de inventario limpiado.');
  }

  return { generateResponse, loadConfig, saveConfig, buildSystemPrompt, clearInventoryCache };
})();
