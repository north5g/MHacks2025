const FALLBACK_ENDPOINT = "http://127.0.0.1:8000/rewrite";

export async function callBackend(text, preset) {
  const { endpoint } = await chrome.storage.sync.get({ endpoint: FALLBACK_ENDPOINT });
  const res = await fetch (endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, style: preset }) // matches FastAPI RewriteReq parameters
  });
  if (!res.ok){
    const msg = await res.text().catch(() => String(res.status));
    throw new Error(`Backend ${res.status}: ${msg}`);
  }
  const json = await res.json();
  return json.rewritten;
}

export function notify(title, message) {
  return new Promise((resolve) => {
    chrome.notifications?.create(
      {
        type: "basic",
        iconUrl: "assets/icon128.png",
        title,
        message
      },
      resolve
    );
  });
}


export async function openTabAndWait(url, { timeoutMs = 20000 } = {}) {
  const tab = await chrome.tabs.create({ url, active: true });
  return new Promise((resolve) => {
    const onUpdated = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve(tab.id);
      }
    };
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(tab.id); // proceed anyway; SPA hydration handled by retry loop
    }, timeoutMs);
    chrome.tabs.onUpdated.addListener((...args) => {
      onUpdated(...args);
      if (args[0] === tab.id && args[1]?.status === "complete") clearTimeout(timer);
    });
  });
}

export async function injectChatGpt(tabId, text) {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [text],
    func: (t) => {
      // --- helpers ---
      const setValueWithEvents = (el, value) => {
        // Use native setter to hit React/Vue controlled inputs
        const proto = el.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc?.set) desc.set.call(el, value);
        else el.value = value;

        // Fire events frameworks listen to
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        try { el.selectionStart = el.selectionEnd = el.value.length; } catch {}
      };

      const setContentEditable = (el, value) => {
        el.focus();
        // Replace contents cleanly
        el.textContent = "";                 // clear
        el.append(document.createTextNode(value));
        el.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertFromPaste",
          data: value
        }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const findEditor = () => {
        // Primary selector ChatGPT uses (as of now)
        let el = document.querySelector("#prompt-textarea");
        if (el) return el;

        // Fallbacks in case markup shifts slightly
        el = document.querySelector('textarea[placeholder*="Message"]')
          || document.querySelector('textarea[aria-label*="Message"]')
          || document.querySelector('textarea');
        if (el) return el;

        // If ChatGPT ever moves to a contenteditable surface:
        el = document.querySelector('[contenteditable=""], [contenteditable="true"]');
        return el || null;
      };

      const tryInsert = () => {
        const el = findEditor();
        if (!el) return false;
        el.focus();
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
          setValueWithEvents(el, t);
        } else if (el.isContentEditable) {
          setContentEditable(el, t);
        } else {
          return false;
        }
        return true;
      };

      if (tryInsert()) return;

      // Retry for SPA hydration (up to ~10s)
      const deadline = Date.now() + 10000;
      const iv = setInterval(() => {
        if (tryInsert() || Date.now() > deadline) clearInterval(iv);
      }, 250);
    }
  });
}


export async function injectGemini(tabId, text) {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [text],
    func: (t) => {
      // ---- helpers ----
      const setValueWithEvents = (el, value) => {
        const proto = el.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc?.set) desc.set.call(el, value); else el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        try { el.selectionStart = el.selectionEnd = el.value.length; } catch {}
      };

      const setContentEditable = (el, value) => {
        el.focus();
        // Replace contents cleanly without execCommand
        el.textContent = "";
        el.append(document.createTextNode(value));
        el.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertFromPaste",
          data: value
        }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };

      // Traverse DOM + shadow DOM (up to a few levels) to find an editor
      const findEditable = () => {
        const isEditable = (el) =>
          el && !el.disabled && !el.readOnly &&
          (el.tagName === "TEXTAREA" ||
           (el.tagName === "INPUT" && /^(text|search|email|url|tel)$/i.test(el.type)) ||
           el.isContentEditable);

        const inTree = (root, depth = 0) => {
          if (!root || depth > 3) return null; // depth guard
          // 1) direct hits we prefer
          let el =
            root.querySelector?.('textarea:not([disabled]):not([readonly])') ||
            root.querySelector?.('input[type="text"]:not([disabled]):not([readonly]), input[type="search"], input[type="email"], input[type="url"], input[type="tel"]') ||
            root.querySelector?.('[contenteditable=""], [contenteditable="true"]');
          if (isEditable(el)) return el;

          // 2) common Gemini custom editor hosts (names can drift; keep broad)
          el = root.querySelector?.('rich-textarea, cfc-textarea, cfc-input, cfc-editor');
          if (el) {
            // many of these have a shadowRoot containing a textarea
            const sr = el.shadowRoot;
            if (sr) {
              const inner =
                sr.querySelector('textarea, input, [contenteditable=""], [contenteditable="true"]');
              if (isEditable(inner)) return inner;
            }
            // sometimes they proxy focus to a descendant
            const descendant =
              el.querySelector?.('textarea, input, [contenteditable=""], [contenteditable="true"]');
            if (isEditable(descendant)) return descendant;
          }

          // 3) walk top-level shadow hosts
          const nodes = root.querySelectorAll?.('*') || [];
          for (const n of nodes) {
            if (n.shadowRoot) {
              const hit = inTree(n.shadowRoot, depth + 1);
              if (isEditable(hit)) return hit;
            }
          }
          return null;
        };

        // Try activeElement first
        if (isEditable(document.activeElement)) return document.activeElement;

        // Try document, then top-level shadow roots
        return inTree(document) ||
               (() => {
                 for (const host of document.querySelectorAll('*')) {
                   if (host.shadowRoot) {
                     const hit = inTree(host.shadowRoot, 1);
                     if (hit) return hit;
                   }
                 }
                 return null;
               })();
      };

      const tryInsert = () => {
        const el = findEditable();
        if (!el) return false;
        el.focus();
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
          setValueWithEvents(el, t);
        } else if (el.isContentEditable) {
          setContentEditable(el, t);
        } else {
          return false;
        }
        return true;
      };

      if (tryInsert()) return;

      // Retry for SPA hydration (up to ~10s)
      const deadline = Date.now() + 10000;
      const iv = setInterval(() => {
        if (tryInsert() || Date.now() > deadline) clearInterval(iv);
      }, 250);
    }
  });
}