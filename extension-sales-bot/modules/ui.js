// ============================================================
// modules/ui.js — Panel flotante SalesBot IA
// Glassmorphism oscuro + tabs + respuestas rápidas
// ============================================================

window.SalesBotUI = (() => {
  let panel = null;
  let isMinimized = false;
  let isGlobalOn = true;
  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;
  let activeTab = 'copilot';
  let currentConfig = {};
  let isGenerating = false;
  let autoResponderInterval = null;

  // ── Respuestas Rápidas por Categoría ─────────────────────
  const QUICK_REPLIES = {
    '✅ Disponibilidad': [
      'Sí, está disponible 😊 ¿Te lo enviamos hoy?',
      '¡Por supuesto! Tenemos stock listo para envío inmediato 🚀',
      'Disponible en este momento. ¿Cuántas unidades necesitas?',
    ],
    '💰 Precio': [
      'El precio es [Precio] con envío incluido a todo el país 📦',
      'Manejamos [Precio] y aceptamos transferencia o efectivo 💳',
      '¿Te parece bien [Precio]? Podemos conversarlo si necesitas 🤝',
    ],
    '🎯 Gancho': [
      '¡Últimas [Precio] disponibles! No se vuelven a conseguir a este precio 🔥',
      'Por esta semana tenemos un descuento especial para clientes nuevos 🎁',
      'Si separas hoy te garantizamos el precio, la semana que viene sube 📈',
    ],
    '🛡️ Objeciones': [
      'Entiendo tu duda. Este producto tiene garantía de devolución en 7 días 💪',
      'Es totalmente normal tener dudas. ¿Qué te genera incertidumbre exactamente? 🤔',
      'Llevamos 3 años vendiendo y tenemos cientos de clientes satisfechos ⭐',
    ],
    '📦 Envíos': [
      'Hacemos envíos a todo el país en 1-3 días hábiles 🚚',
      'El envío es gratis para compras mayores a [Precio] 🎉',
      'Trabajamos con transportadoras seguras y te enviamos el tracking 📍',
    ],
    '✍️ Cierre': [
      '¿Te lo reservo? Solo necesito tu nombre y ciudad 😊',
      'Perfecto, ¿hacemos el pedido ahora? Dame tu dirección y lo enviamos hoy 📦',
      '¡Excelente elección! ¿Vas a querer 1 o aprovechar y llevar 2? 😄',
    ],
    '🙏 Seguimiento': [
      '¡Hola [Nombre]! ¿Pudiste revisar la información que te mandé? 😊',
      'Quería saber si tienes alguna pregunta adicional sobre el producto 🤗',
      '¿Sigues interesado/a? Puedo guardarte las últimas unidades disponibles 💫',
    ],
    '⭐ Testimonios': [
      'Mira lo que dicen nuestros clientes ➡️ [enlace de reseñas]',
      'La semana pasada vendimos más de 50 unidades ¡están encantados! 🌟',
      'Aquí un comentario real de una clienta: "excelente calidad, llegó perfecto" ❤️',
    ],
    '🎁 Descuentos': [
      'Por ser cliente nuevo, te hago [Precio] con 10% de descuento 🎁',
      'Si llevas dos, el segundo tiene 20% off. ¿Te animas? 🔥',
      'Solo por hoy tenemos precio especial. ¿Aprovechamos? ⏰',
    ],
    '🤗 Bienvenida': [
      '¡Hola [Nombre]! Bienvenido/a 😊 ¿En qué te puedo ayudar hoy?',
      'Buenos días [Nombre]! Cuéntame, ¿qué estás buscando? 🌟',
      'Hola! Gracias por escribirnos. Estoy aquí para ayudarte 💙',
    ],
    '📸 Fotos/Info': [
      '¡Claro! Te mando las fotos del producto de inmediato 📸',
      'Te comparto el catálogo completo ahora 📖',
      'Aquí tienes más información: [descripción detallada del producto]',
    ],
    '🔄 Recompra': [
      '¡Hola [Nombre]! ¿Cómo te fue con el producto? ¿Ya lo probaste? 😊',
      'Tenemos novedades que creo que te van a encantar 🌟',
      '¡Volvemos a tener stock! Sé que habías preguntado antes 💙',
    ],
  };

  // ── Sistema de drag ───────────────────────────────────────

  function initDrag() {
    const header = panel.querySelector('#sb-header');
    header.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      panel.style.transition = 'none';
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const x = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - panel.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - panel.offsetHeight));
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = x + 'px';
      panel.style.top = y + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      panel.style.transition = '';
    });
  }

  // ── Renderizado de tabs ───────────────────────────────────

  function renderCopilotTab() {
    return `
      <div class="sb-tab-content" id="sb-tab-copilot">
        <div class="sb-context-bar">
          <input class="sb-input" id="sb-ctx-product" placeholder="🏷️ Producto (auto-detectado)" maxlength="60">
          <input class="sb-input" id="sb-ctx-price" placeholder="💰 Precio" maxlength="30">
          <input class="sb-input" id="sb-ctx-client" placeholder="👤 Cliente (auto-detectado)" maxlength="40">
        </div>
        <div class="sb-ai-area">
          <textarea id="sb-custom-prompt" class="sb-textarea" placeholder="✨ Pregunta libre para la IA... ej: 'El cliente dice que está caro, ¿qué respondo?'" rows="3"></textarea>
          <button class="sb-btn sb-btn-primary" id="sb-generate-btn">
            <span id="sb-generate-text">✨ Generar Respuesta</span>
          </button>
        </div>
        <div class="sb-response-area" id="sb-response-area" style="display:none">
          <div class="sb-response-label">💬 Respuesta sugerida</div>
          <div class="sb-response-text" id="sb-response-text"></div>
          <div class="sb-response-actions">
            <button class="sb-btn sb-btn-secondary" id="sb-copy-btn">📋 Copiar</button>
            <button class="sb-btn sb-btn-accent" id="sb-insert-btn">
              <span id="sb-insert-label">⚡ Insertar</span>
            </button>
          </div>
        </div>
        <div class="sb-mode-toggle">
          <label class="sb-toggle-label">
            <span>Modo Copiloto</span>
            <div class="sb-toggle" id="sb-mode-toggle">
              <div class="sb-toggle-knob"></div>
            </div>
            <span id="sb-mode-label">✋ Manual</span>
          </label>
        </div>
      </div>`;
  }

  function renderRepliesTab() {
    let html = '<div class="sb-tab-content sb-replies-tab" id="sb-tab-replies">';
    for (const [category, replies] of Object.entries(QUICK_REPLIES)) {
      html += `<div class="sb-category">
        <div class="sb-category-header">${category}</div>
        <div class="sb-category-replies">`;
      replies.forEach((reply, idx) => {
        html += `<button class="sb-quick-reply" data-category="${category}" data-index="${idx}">${reply}</button>`;
      });
      html += `</div></div>`;
    }
    html += '</div>';
    return html;
  }

  function renderConfigTab() {
    return `
      <div class="sb-tab-content" id="sb-tab-config">
        <div class="sb-config-section">
          <label class="sb-label">🤖 Modelo preferido</label>
          <select class="sb-select" id="sb-model-select">
            <option value="groq-llama-70b">⚡ Llama 3.3 70B (Groq - Rápido)</option>
            <option value="groq-llama-8b">🚀 Llama 3.1 8B (Groq - Ultra rápido)</option>
            <option value="openrouter-mistral">🌐 Mistral 7B (OpenRouter - Fallback)</option>
            <option value="openrouter-gemma">🌍 Gemma 2 9B (OpenRouter - Fallback)</option>
          </select>
        </div>
        <div class="sb-config-section">
          <label class="sb-label">⏱️ Retraso humanizador</label>
          <div class="sb-slider-row">
            <input type="range" class="sb-slider" id="sb-delay-slider" min="500" max="5000" step="250" value="1500">
            <span class="sb-slider-value" id="sb-delay-value">1.5s</span>
          </div>
          <div class="sb-slider-hint">Mayor tiempo = más natural para las plataformas</div>
        </div>
        <div class="sb-config-section">
          <label class="sb-label">🔑 API Keys Locales</label>
          <input type="password" class="sb-input" id="sb-groq-key" placeholder="Groq API Key (gsk_...)" style="margin-bottom: 6px;">
          <input type="password" class="sb-input" id="sb-or-key" placeholder="OpenRouter Key (Opcional)">
          <div class="sb-key-hint-text" id="sb-key-save-status" style="color: #4ade80; margin-top: 4px;"></div>
        </div>
        <div class="sb-config-section">
          <label class="sb-label">🔄 Última sincronización</label>
          <div class="sb-sync-info" id="sb-sync-info">Verificando...</div>
          <button class="sb-btn sb-btn-secondary" id="sb-sync-btn" style="margin-top:6px;width:100%">
            🔄 Sincronizar con Dashboard
          </button>
        </div>
      </div>`;
  }

  // ── Constructor del panel ─────────────────────────────────

  function buildPanel() {
    const platform = window.SalesBotPlatform?.current;
    if (!platform) return;

    panel = document.createElement('div');
    panel.id = 'salesbot-panel';
    panel.innerHTML = `
      <div id="sb-header">
        <div class="sb-header-left">
          <div class="sb-platform-badge" style="background: ${platform.color}20; border: 1px solid ${platform.color}60">
            ${platform.emoji} ${platform.label}
          </div>
          <span class="sb-title">SalesBot IA</span>
        </div>
        <div class="sb-header-right">
          <div class="sb-global-toggle" id="sb-global-toggle" title="Bot ON/OFF">
            <div class="sb-status-dot active"></div>
            <span id="sb-status-text">ON</span>
          </div>
          <button class="sb-icon-btn" id="sb-minimize-btn" title="Minimizar">─</button>
        </div>
      </div>

      <div id="sb-body">
        <div class="sb-tabs">
          <button class="sb-tab active" data-tab="copilot">✨ Copiloto</button>
          <button class="sb-tab" data-tab="replies">⚡ Respuestas</button>
          <button class="sb-tab" data-tab="config">⚙️ Config</button>
        </div>

        <div id="sb-tabs-container">
          ${renderCopilotTab()}
          ${renderRepliesTab()}
          ${renderConfigTab()}
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    initDrag();
    bindEvents();
    loadConfigAndApply();
    autoDetectContext();
  }

  // ── Eventos ───────────────────────────────────────────────

  function bindEvents() {
    // Minimizar
    panel.querySelector('#sb-minimize-btn').addEventListener('click', toggleMinimize);

    // Global toggle
    panel.querySelector('#sb-global-toggle').addEventListener('click', toggleGlobal);

    // Tabs
    panel.querySelectorAll('.sb-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Generar respuesta
    panel.querySelector('#sb-generate-btn').addEventListener('click', handleGenerate);

    // Copiar
    panel.querySelector('#sb-copy-btn').addEventListener('click', handleCopy);

    // Insertar
    panel.querySelector('#sb-insert-btn').addEventListener('click', handleInsert);

    // Toggle modo copiloto
    panel.querySelector('#sb-mode-toggle').addEventListener('click', toggleMode);

    // Quick replies
    panel.querySelectorAll('.sb-quick-reply').forEach(btn => {
      btn.addEventListener('click', () => handleQuickReply(btn));
    });

    // Modelo
    panel.querySelector('#sb-model-select').addEventListener('change', (e) => {
      updateConfig({ preferred_model: e.target.value });
    });

    // Delay slider
    const slider = panel.querySelector('#sb-delay-slider');
    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      panel.querySelector('#sb-delay-value').textContent = (val / 1000).toFixed(1) + 's';
      updateConfig({ delay_ms: val });
    });

    // API Keys guardado automático
    const handleKeySave = () => {
      const groq = panel.querySelector('#sb-groq-key').value.trim();
      const or = panel.querySelector('#sb-or-key').value.trim();
      updateConfig({ groq_api_key: groq, openrouter_api_key: or });
      console.log('[SalesBot] Key guardada:', groq ? 'Groq=' + groq.substring(0, 10) + '...' : '(vacía)', or ? 'OR=' + or.substring(0, 8) + '...' : '(vacía)');
      
      const status = panel.querySelector('#sb-key-save-status');
      status.textContent = '✅ Guardado localmente';
      setTimeout(() => status.textContent = '', 2000);
    };

    ['input', 'change', 'blur'].forEach(evt => {
      panel.querySelector('#sb-groq-key').addEventListener(evt, handleKeySave);
      panel.querySelector('#sb-or-key').addEventListener(evt, handleKeySave);
    });

    // Sync
    panel.querySelector('#sb-sync-btn').addEventListener('click', handleSync);
  }

  // ── Acciones del panel ────────────────────────────────────

  function toggleMinimize() {
    isMinimized = !isMinimized;
    const body = panel.querySelector('#sb-body');
    body.style.display = isMinimized ? 'none' : 'block';
    panel.querySelector('#sb-minimize-btn').textContent = isMinimized ? '□' : '─';
  }

  function toggleGlobal() {
    isGlobalOn = !isGlobalOn;
    const dot = panel.querySelector('.sb-status-dot');
    const text = panel.querySelector('#sb-status-text');
    dot.className = 'sb-status-dot ' + (isGlobalOn ? 'active' : 'inactive');
    text.textContent = isGlobalOn ? 'ON' : 'OFF';
    updateConfig({ bot_enabled: isGlobalOn });
  }

  function switchTab(tabId) {
    activeTab = tabId;
    panel.querySelectorAll('.sb-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));

    const tabIds = ['copilot', 'replies', 'config'];
    tabIds.forEach(id => {
      const el = panel.querySelector(`#sb-tab-${id}`);
      if (el) el.style.display = id === tabId ? 'block' : 'none';
    });
  }

  async function handleGenerate() {
    if (isGenerating) return;
    isGenerating = true;

    const btn = panel.querySelector('#sb-generate-btn');
    const btnText = panel.querySelector('#sb-generate-text');
    btnText.textContent = '⏳ Generando...';
    btn.disabled = true;

    const history = window.SalesBotScanner?.getHistory() || [];
    const customPrompt = panel.querySelector('#sb-custom-prompt').value;
    const context = {
      product: panel.querySelector('#sb-ctx-product').value,
      price: panel.querySelector('#sb-ctx-price').value,
      clientName: panel.querySelector('#sb-ctx-client').value,
    };

    const result = await window.SalesBotAI?.generateResponse({
      history,
      customPrompt,
      context,
      config: currentConfig
    });

    isGenerating = false;
    btn.disabled = false;
    btnText.textContent = '✨ Generar Respuesta';

    if (result?.success) {
      showResponse(result.text);
      // Mostrar qué modelo usó
      if (result.modelUsed) {
        const hint = document.createElement('div');
        hint.className = 'sb-model-used';
        hint.textContent = `Modelo: ${result.modelUsed}`;
        const responseArea = panel.querySelector('#sb-response-area');
        const existing = responseArea.querySelector('.sb-model-used');
        if (existing) existing.remove();
        responseArea.insertBefore(hint, responseArea.firstChild);
      }
    } else {
      showError(result?.error || 'Error desconocido');
    }
  }

  function showResponse(text) {
    const area = panel.querySelector('#sb-response-area');
    const textEl = panel.querySelector('#sb-response-text');
    textEl.textContent = text;
    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showError(message) {
    const area = panel.querySelector('#sb-response-area');
    const textEl = panel.querySelector('#sb-response-text');
    textEl.innerHTML = `<span style="color:#ff6b6b">❌ ${message}</span>`;
    area.style.display = 'block';
  }

  function handleCopy() {
    const text = panel.querySelector('#sb-response-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = panel.querySelector('#sb-copy-btn');
      btn.textContent = '✅ Copiado';
      setTimeout(() => btn.textContent = '📋 Copiar', 2000);
    });
  }

  async function handleInsert() {
    const text = panel.querySelector('#sb-response-text').textContent;
    if (!text) return;

    const autoSend = !currentConfig.copilot_mode; // Si NO es copiloto, envía solo
    const label = panel.querySelector('#sb-insert-label');
    label.textContent = '⏳ Insertando...';

    const result = await window.SalesBotInserter?.insertText(text, autoSend, {
      delayMs: currentConfig.delay_ms || 1500
    });

    label.textContent = result?.success
      ? (autoSend ? '✅ Enviado!' : '✅ Insertado!')
      : '❌ Error';

    setTimeout(() => label.textContent = '⚡ Insertar', 2500);
  }

  function toggleMode() {
    const toggle = panel.querySelector('#sb-mode-toggle');
    const label = panel.querySelector('#sb-mode-label');
    const isCopilot = toggle.classList.toggle('active');
    label.textContent = isCopilot ? '✋ Manual' : '🤖 Auto';
    updateConfig({ copilot_mode: isCopilot });
  }

  async function handleQuickReply(btn) {
    let reply = btn.textContent;

    // Reemplazar variables con contexto actual
    const clientName = panel.querySelector('#sb-ctx-client').value || 'amigo/a';
    const product = panel.querySelector('#sb-ctx-product').value || '';
    const price = panel.querySelector('#sb-ctx-price').value || '';

    reply = reply.replace(/\[Nombre\]/gi, clientName);
    reply = reply.replace(/\[Producto\]/gi, product || '[producto]');
    reply = reply.replace(/\[Precio\]/gi, price || '[precio]');

    const autoSend = !currentConfig.copilot_mode;
    btn.style.opacity = '0.5';

    const result = await window.SalesBotInserter?.insertText(reply, autoSend);

    btn.style.opacity = '1';
    if (result?.success) {
      btn.style.background = 'rgba(100,255,150,0.15)';
      setTimeout(() => btn.style.background = '', 1500);
    }
  }

  async function handleSync() {
    const btn = panel.querySelector('#sb-sync-btn');
    btn.textContent = '⏳ Sincronizando...';
    btn.disabled = true;
    await loadConfigAndApply();
    btn.textContent = '✅ Sincronizado';
    btn.disabled = false;
    setTimeout(() => btn.textContent = '🔄 Sincronizar con Dashboard', 2000);
  }

  // ── Config ────────────────────────────────────────────────

  async function loadConfigAndApply() {
    const config = await window.SalesBotAI?.loadConfig();
    currentConfig = config || {};
    applyConfigToUI(currentConfig);
  }

  function applyConfigToUI(config) {
    // Modelo
    const modelSelect = panel.querySelector('#sb-model-select');
    if (modelSelect && config.preferred_model) {
      modelSelect.value = config.preferred_model;
    }

    // Delay
    const slider = panel.querySelector('#sb-delay-slider');
    if (slider && config.delay_ms) {
      slider.value = config.delay_ms;
      panel.querySelector('#sb-delay-value').textContent = (config.delay_ms / 1000).toFixed(1) + 's';
    }

    // Modo copiloto
    const toggle = panel.querySelector('#sb-mode-toggle');
    const label = panel.querySelector('#sb-mode-label');
    if (config.copilot_mode !== undefined) {
      toggle.classList.toggle('active', config.copilot_mode);
      label.textContent = config.copilot_mode ? '✋ Manual' : '🤖 Auto';
    }

    // Estado API Keys (Inputs)
    const groqInput = panel.querySelector('#sb-groq-key');
    const orInput = panel.querySelector('#sb-or-key');
    if (groqInput && config.groq_api_key) groqInput.value = config.groq_api_key;
    if (orInput && config.openrouter_api_key) orInput.value = config.openrouter_api_key;

    // Sync info
    const syncInfo = panel.querySelector('#sb-sync-info');
    syncInfo.textContent = config.business_name
      ? `Negocio: ${config.business_name} · ${new Date().toLocaleTimeString()}`
      : 'Dashboard no sincronizado aún';

    // Bot enabled
    if (config.bot_enabled === false) {
      isGlobalOn = false;
      panel.querySelector('.sb-status-dot').className = 'sb-status-dot inactive';
      panel.querySelector('#sb-status-text').textContent = 'OFF';
    }
  }

  async function updateConfig(patch) {
    currentConfig = { ...currentConfig, ...patch };
    await window.SalesBotAI?.saveConfig(patch);
  }

  // ── Auto-detección de contexto DOM ───────────────────────

  function autoDetectContext() {
    const platform = window.SalesBotPlatform;
    if (!platform) return;

    // Intenta rellenar los campos. Retorna true si encontró nombre.
    const update = () => {
      const clientInput  = panel.querySelector('#sb-ctx-client');
      const productInput = panel.querySelector('#sb-ctx-product');
      const priceInput   = panel.querySelector('#sb-ctx-price');
      if (!clientInput || !productInput) return false;

      // Cliente
      const clientName = platform.getContactName();
      console.log('[SalesBot Context] getContactName() =>', clientName || '(vacío)');
      if (clientName && !clientInput.value) {
        clientInput.value = clientName;
        clientInput.placeholder = `👤 ${clientName}`;
      }

      // Producto + Precio
      const productCtx = platform.extractProductContext();
      console.log('[SalesBot Context] extractProductContext() =>', productCtx);
      if (productCtx?.value && !productInput.value) {
        productInput.value = productCtx.value;
        productInput.placeholder = `🏷️ ${productCtx.value}`;
        if (productCtx.price && priceInput && !priceInput.value) {
          priceInput.value = productCtx.price;
        }
      }

      return !!clientName;
    };

    // Fallback infinito: en SPAs como Facebook Messenger, vamos a reintentar
    // constantemente pero SOLO actualizando campos si el usuario cambió de chat (URL cambió)
    // El observer limpiará los campos, lo que permitirá que el intervalo vuelva a escribir
    setInterval(() => {
       update();
    }, 2000);

    // Observar cambios de URL (SPA navigation)
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log('[SalesBot] Navigated to new chat, clearing context fields.');
        // Un poco de delay para que React/Facebook limpie el DOM viejo 
        setTimeout(() => {
          const c = panel.querySelector('#sb-ctx-client');
          const pd = panel.querySelector('#sb-ctx-product');
          const pc = panel.querySelector('#sb-ctx-price');
          if (c) c.value = '';
          if (pd) pd.value = '';
          if (pc) pc.value = '';
          // El setInterval de 2s arriba se encargará de rellenar esto tan pronto aparezca en el DOM
        }, 800);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Inicialización pública ────────────────────────────────

  function init() {
    // Esperar a que el DOM esté listo
    const timer = setInterval(() => {
      const platform = window.SalesBotPlatform?.current;
      if (platform && document.body) {
        clearInterval(timer);
        buildPanel();
        // Mostrar tab inicial
        switchTab('copilot');
        console.log(`[SalesBot UI] Panel iniciado en ${platform.label}`);
      }
    }, 500);
  }

  function destroy() {
    if (panel) {
      panel.remove();
      panel = null;
    }
    if (autoResponderInterval) {
      clearInterval(autoResponderInterval);
    }
  }

  return { init, destroy };
})();
