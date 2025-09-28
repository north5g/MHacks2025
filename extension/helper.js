const FALLBACK_ENDPOINT = "http://127.0.0.1:8000/rewrite";


export async function callBackend(text) {
  // Get endpoint from Chrome storage (fallback if not set)
  const { endpoint } = await chrome.storage.sync.get({ endpoint: FALLBACK_ENDPOINT });

  // Get tone and tags from chrome.storage.local
  const storageData = await chrome.storage.local.get(null);

  const tone = storageData.userTone || null;

  const tags = [];
  const tagCount = parseInt(storageData.userTagCount || '0', 10);
  for (let i = 0; i < tagCount; i++) {
    const tag = storageData[`userTag_${i}`];
    if (tag) tags.push(tag);
  }

  const payload = { text, tone, tags };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => String(res.status));
    throw new Error(`Backend ${res.status}: ${msg}`);
  }

  const { rewritten } = await res.json();
  if (!rewritten) throw new Error("Backend response missing `rewritten` field");

  return rewritten;
}


export function notify(title, message) {
  return new Promise((resolve) => {
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create(
        {
          type: "basic",
          iconUrl: "assets/icon128.png",
          title,
          message
        },
        resolve
      );
    } else {
      resolve(); // fallback
    }
  });
}



export function pasteChatGpt(text) {
  console.log("pasteChatGpt called with text:", text);
  
  chrome.tabs.create(
    {
      url: "https://chatgpt.com/",
      active: true
    },
    (newTab) => {
      console.log("ChatGPT tab created:", newTab.id);
      
      // Wait for the tab to finish loading before injecting the script
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        console.log("Tab update:", tabId, info.status);
        
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          console.log("ChatGPT tab loaded, injecting script in 1 second...");
          
          // Add a small additional delay to ensure ChatGPT's React components are ready
          setTimeout(() => {
            console.log("Executing script to insert text");
            chrome.scripting.executeScript({
              target: { tabId: newTab.id },
              func: insertIntoChatGpt,
              args: [text]
            }).then(() => {
              console.log("Script execution completed");
            }).catch((err) => {
              console.error("Script execution failed:", err);
            });
          }, 1000);
        }
      });
    }
  );
}

export function insertIntoChatGpt(text) {
  console.log("Attempting to insert text into ChatGPT:", text);
  
  // Selectors for current ChatGPT interface
  const selectors = [
    "textarea[data-id='root']", // New ChatGPT selector
    "#prompt-textarea", // Primary textarea ID
    "textarea#prompt-textarea", // Old selector format
    "[data-testid='composer-input']", // Possible test ID
    "[data-testid='message-input']", // Alternative test ID
    "textarea[placeholder*='Message']",
    "textarea[placeholder*='Send a message']",
    "textarea[placeholder*='message']", // lowercase
    "div[contenteditable='true']",
    "textarea", // Generic fallback
    "div.ProseMirror", // Rich text editor
    "div[role='textbox']" // Accessibility role
  ];
  
  console.log("Available textareas on page:", document.querySelectorAll("textarea").length);
  console.log("Available contenteditable divs:", document.querySelectorAll("div[contenteditable='true']").length);
  
  let editor = null;
  for (const selector of selectors) {
    editor = document.querySelector(selector);
    console.log(`Trying selector "${selector}":`, editor ? "Found!" : "Not found");
    if (editor) break;
  }
  
  if (editor) {
    console.log("Found editor element:", editor.tagName, editor.className, editor.id);
    
    try {
      // For textarea elements
      if (editor.tagName === 'TEXTAREA') {
        console.log("Handling TEXTAREA element");
        
        editor.value = text;
        
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeInputValueSetter.call(editor, text);
        
        // Dispatch multiple events to ensure React picks up the change
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
        
        
        editor.focus();
        editor.blur();
        editor.focus();
      } 
      // For contenteditable divs (rich text editors)
      else if (editor.contentEditable === 'true' || editor.getAttribute('contenteditable') === 'true') {
        console.log("Handling contenteditable element");
        
        // Clear existing content
        editor.innerHTML = '';
        
        // Insert text
        if (editor.classList.contains('ProseMirror')) {
          // ProseMirror rich text editor
          const p = document.createElement('p');
          p.textContent = text;
          editor.appendChild(p);
        } else {
          // Regular contenteditable
          editor.textContent = text;
        }
        
        
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.focus();
      }
      
      else if (editor.tagName === 'INPUT') {
        console.log("Handling INPUT element");
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(editor, text);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.focus();
      }
      
      console.log("Text successfully inserted into ChatGPT!");
      
      // Try to trigger any possible submit or send actions
      setTimeout(() => {
        const sendButton = document.querySelector('button[data-testid="send-button"]') || 
                          document.querySelector('button[aria-label*="Send"]') ||
                          document.querySelector('button:has(svg)');
        if (sendButton) {
          console.log("Found potential send button:", sendButton);
        }
      }, 500);
      
    } catch (error) {
      console.error("Error inserting text:", error);
    }
  } else {
    console.log("ChatGPT editor not found! Available elements:");
    console.log("All textareas:", Array.from(document.querySelectorAll("textarea")).map(t => ({
      tag: t.tagName,
      id: t.id,
      className: t.className,
      placeholder: t.placeholder
    })));
    console.log("All contenteditable:", Array.from(document.querySelectorAll("[contenteditable='true']")).map(t => ({
      tag: t.tagName,
      id: t.id,
      className: t.className
    })));
    
    // Retry after 2 seconds if not found
    setTimeout(() => insertIntoChatGpt(text), 2000);
  }
}

export function pasteGemini(text) {
  console.log("pasteGemini called with text:", text);
  
  chrome.tabs.create(
    {
      url: "https://gemini.google.com/",
      active: true
    },
    (newTab) => {
      console.log("Gemini tab created:", newTab.id);
      
      // Wait for the tab to finish loading before injecting the script
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        console.log("Gemini tab update:", tabId, info.status);
        
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          console.log("Gemini tab loaded, injecting script in 1 second...");
          
          // Add a small additional delay to ensure Gemini's components are ready
          setTimeout(() => {
            console.log("Executing script to insert text into Gemini");
            chrome.scripting.executeScript({
              target: { tabId: newTab.id },
              func: insertIntoGemini,
              args: [text]
            }).then(() => {
              console.log("Gemini script execution completed");
            }).catch((err) => {
              console.error("Gemini script execution failed:", err);
            });
          }, 1000);
        }
      });
    }
  );
}

export function insertIntoGemini(text) {
  console.log("Attempting to insert text into Gemini:", text);
  
  // Selectors for current Gemini interface
  const selectors = [
    "div.ql-editor", // Quill editor
    "div.ql-editor[contenteditable='true']", // Quill editor v2
    // "rich-textarea", // Primary Gemini input
    "textarea[aria-label*='Enter a prompt']", // Accessibility label
    "textarea[placeholder*='Enter a prompt']", // Placeholder text
    "[data-testid='composer-input']", // Possible test ID
    "[data-testid='message-input']", // Alternative test ID
    "div[contenteditable='true']", // Rich text editor
    "textarea", // Generic fallback
    "div[role='textbox']", // Accessibility role
    "textarea[placeholder*='prompt']" // Lowercase prompt
  ];
  
  console.log("Available textareas on Gemini page:", document.querySelectorAll("textarea").length);
  console.log("Available contenteditable divs:", document.querySelectorAll("div[contenteditable='true']").length);
  console.log("Available rich-textarea elements:", document.querySelectorAll("rich-textarea").length);
  
  let editor = null;
  for (const selector of selectors) {
    editor = document.querySelector(selector);
    console.log(`Trying Gemini selector "${selector}":`, editor ? "Found!" : "Not found");
    if (editor) break;
  }
  
  if (editor) {
    console.log("Found Gemini editor element:", editor.tagName, editor.className, editor.id);
    
    try {
      // For rich-textarea elements (Gemini's custom component)
      if (editor.tagName === 'RICH-TEXTAREA') {
        console.log("Handling RICH-TEXTAREA element");
        
        // Try different approaches for rich-textarea
        if (editor.value !== undefined) {
          editor.value = text;
        } else if (editor.textContent !== undefined) {
          editor.textContent = text;
        } else if (editor.innerHTML !== undefined) {
          editor.innerHTML = text;
        }
        
        // Dispatch events
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.focus();
      }
      // For regular textarea elements
      else if (editor.tagName === 'TEXTAREA') {
        console.log("Handling TEXTAREA element");
        
        editor.value = text;
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeInputValueSetter.call(editor, text);
        
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
        
        editor.focus();
        editor.blur();
        editor.focus();
      } 
      // For contenteditable divs
      else if (editor.contentEditable === 'true' || editor.getAttribute('contenteditable') === 'true') {
        console.log("Handling contenteditable element");
        
        // Clear existing content
        editor.innerHTML = '';
        
        // Insert text
        if (editor.classList.contains('ql-editor')) {
          // Quill editor
          const p = document.createElement('p');
          p.textContent = text;
          editor.appendChild(p);
        } else {
          // Regular contenteditable
          editor.textContent = text;
        }
        
        // Dispatch events
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.focus();
      }
      // For input elements
      else if (editor.tagName === 'INPUT') {
        console.log("Handling INPUT element");
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(editor, text);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.focus();
      }
      
      console.log("Text successfully inserted into Gemini!");
      
      // Try to find send button
      setTimeout(() => {
        const sendButton = document.querySelector('button[data-testid="send-button"]') || 
                          document.querySelector('button[aria-label*="Send"]') ||
                          document.querySelector('button:has(svg)') ||
                          document.querySelector('button[type="submit"]');
        if (sendButton) {
          console.log("Found potential Gemini send button:", sendButton);
        }
      }, 500);
      
    } catch (error) {
      console.error("Error inserting text into Gemini:", error);
    }
  } else {
    console.log("Gemini editor not found! Available elements:");
    console.log("All textareas:", Array.from(document.querySelectorAll("textarea")).map(t => ({
      tag: t.tagName,
      id: t.id,
      className: t.className,
      placeholder: t.placeholder,
      ariaLabel: t.getAttribute('aria-label')
    })));
    console.log("All contenteditable:", Array.from(document.querySelectorAll("[contenteditable='true']")).map(t => ({
      tag: t.tagName,
      id: t.id,
      className: t.className
    })));
    console.log("All rich-textarea:", Array.from(document.querySelectorAll("rich-textarea")).map(t => ({
      tag: t.tagName,
      id: t.id,
      className: t.className
    })));
    
    // Retry after 2 seconds if not found
    setTimeout(() => insertIntoGemini(text), 2000);
  }
}

// pasteFetchAI.js
export function pasteFetchAI(text, openUrl = "https://asi1.ai/") {
  console.log("pasteFetchAI called with text:", text);

  chrome.tabs.create(
    {
      url: openUrl,
      active: true
    },
    (newTab) => {
      if (!newTab || !newTab.id) {
        console.error("Failed to create tab:", newTab);
        return;
      }
      console.log("Fetch.ai tab created:", newTab.id);

      // Wait for the tab to finish loading before injecting the script
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        console.log("Fetch.ai tab update:", tabId, info.status);
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);

          // Small additional delay to let complex Single Page App components initialize
          setTimeout(() => {
            console.log("Executing script to insert text into Fetch.ai");
            chrome.scripting.executeScript({
              target: { tabId: newTab.id },
              func: insertIntoFetchAI,
              args: [text]
            }).then(() => {
              console.log("Fetch.ai script execution completed");
            }).catch((err) => {
              console.error("Fetch.ai script execution failed:", err);
            });
          }, 1100);
        }
      });
    }
  );
}

// This function runs inside the Fetch.ai page (content script context).
export function insertIntoFetchAI(text) {
  console.log("insertIntoFetchAI running. Text length:", text?.length);

  /**************************************************************************
   * Helpers
   **************************************************************************/
  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // deepQuerySelector: traverse document + shadow roots to find first match
  function deepQuerySelector(root, selector) {
    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch (e) {
      // some selectors might throw on exotic roots, ignore
    }

    // search shadow roots recursively
    const tree = root.querySelectorAll('*');
    for (const node of tree) {
      if (node.shadowRoot) {
        const found = deepQuerySelector(node.shadowRoot, selector);
        if (found) return found;
      }
    }
    return null;
  }

  // try all selectors, across main document and reachable iframes (same-origin)
  function findEditor(selectors) {
    for (const sel of selectors) {
      // try main document (including shadow roots)
      const inMain = deepQuerySelector(document, sel);
      if (inMain) return { element: inMain, frame: window };

      // try same-origin frames
      for (let i = 0; i < window.frames.length; i++) {
        try {
          const frameDoc = window.frames[i].document;
          const found = deepQuerySelector(frameDoc, sel);
          if (found) return { element: found, frame: window.frames[i] };
        } catch (e) {
          // cross-origin frames will throw — can't access them
          // we'll detect this case later as a crossOrigin fallback
        }
      }
    }
    return null;
  }

  function setInputValueNative(el, text) {
    try {
      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(el, text);
      } else if (el.tagName === 'INPUT') {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, text);
      } else {
        // Non-input; fall back below
        el.textContent = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) {
      console.warn("native setter failed:", e);
      return false;
    }
  }

  function setContentEditable(el, text) {
    try {
      el.focus();
      // Best-effort: special-case ProseMirror, Quill, Slate-ish editors
      if (el.classList && el.classList.contains('ProseMirror')) {
        el.innerHTML = '';
        const p = document.createElement('p');
        p.textContent = text;
        el.appendChild(p);
      } else if (el.classList && el.classList.contains('ql-editor')) {
        // Quill
        el.innerHTML = '';
        const textNode = document.createTextNode(text);
        el.appendChild(textNode);
      } else {
        // generic contenteditable
        // clear then insert a text node
        el.innerHTML = '';
        const n = document.createTextNode(text);
        el.appendChild(n);
      }
      // Fire input/change events that frameworks listen to
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) {
      console.warn("setContentEditable failed:", e);
      return false;
    }
  }

  // attempt to "send" by (1) clicking likely buttons (2) pressing Enter programmatically (best-effort) (3) submitting forms
  async function attemptSend(editorEl) {
    // try to find a send button using deep search
    const buttonSelectors = [
      'button[aria-label*="send"]',
      'button[title*="send"]',
      'button[data-testid*="send"]',
      'button[type="submit"]',
      'button'
    ];

    // deep find by scanning all button-like elements and filtering
    const candidates = [];
    const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
    for (const b of allButtons) {
      try {
        const label = ((b.innerText || '') + ' ' + (b.getAttribute && b.getAttribute('aria-label') || '') + ' ' + (b.title || '')).trim().toLowerCase();
        if (/send|submit|reply|enter|paper-plane|arrow/i.test(label)) {
          candidates.push(b);
        } else if (b.querySelector && b.querySelector('svg')) {
          // heuristic: svg icon button might be a send button (arrow/paper plane)
          candidates.push(b);
        }
      } catch (e) { /* ignore */ }
    }

    // click the first candidate that looks reasonable
    if (candidates.length > 0) {
      try {
        candidates[0].click();
        console.log("Clicked candidate send button:", candidates[0]);
        return true;
      } catch (e) {
        console.warn("click on candidate failed:", e);
      }
    }

    // fallback: try to submit enclosing form
    try {
      const form = editorEl && editorEl.closest && editorEl.closest('form');
      if (form) {
        form.submit();
        console.log("Submitted enclosing form");
        return true;
      }
    } catch (e) {
      console.warn("form.submit failed:", e);
    }

    // fallback: dispatch Enter key events (note: many apps ignore synthetic key events)
    try {
      const down = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
      const press = new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
      const up = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
      editorEl.dispatchEvent(down);
      editorEl.dispatchEvent(press);
      editorEl.dispatchEvent(up);
      console.log("Dispatched Enter key events to editor");
      // still may not trigger; return false so a fallback happens
      return true;
    } catch (e) {
      console.warn("Enter dispatch failed:", e);
    }

    return false;
  }

  // overlay UI shown when automatic send can't be completed (one-click manual fallback)
  function showOverlayClipboardFallback(text, editorEl, sendCallback) {
    // Remove any previous overlay
    const existing = document.getElementById('__fetchai_paste_overlay_v1');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = '__fetchai_paste_overlay_v1';
    overlay.style.position = 'fixed';
    overlay.style.right = '16px';
    overlay.style.bottom = '16px';
    overlay.style.zIndex = 2147483647;
    overlay.style.maxWidth = '420px';
    overlay.style.padding = '12px 14px';
    overlay.style.borderRadius = '10px';
    overlay.style.boxShadow = '0 6px 18px rgba(0,0,0,0.18)';
    overlay.style.background = 'white';
    overlay.style.color = '#111';
    overlay.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    overlay.style.fontSize = '13px';

    overlay.innerHTML = `
      <div style="margin-bottom:8px"><strong>Couldn't auto-send on this page</strong></div>
      <div style="margin-bottom:8px">I copied your text to the clipboard. If the editor appears, click <strong>Paste & Send</strong> to attempt a focused paste and click send.</div>
    `;

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';

    const pasteBtn = document.createElement('button');
    pasteBtn.textContent = 'Paste & Send';
    pasteBtn.style.padding = '8px 10px';
    pasteBtn.style.borderRadius = '8px';
    pasteBtn.style.cursor = 'pointer';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.padding = '8px 10px';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.background = 'transparent';

    pasteBtn.onclick = async () => {
      try {
        // attempt to write to clipboard again (best-effort)
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        }
      } catch (e) {
        console.warn("navigator.clipboard.writeText failed on paste click:", e);
      }

      // try to set text into known editor element and send
      if (editorEl) {
        // prefer native setter
        const ok = setInputValueNative(editorEl, text) || setContentEditable(editorEl, text);
        if (ok) {
          await sleep(80);
          const sent = await attemptSend(editorEl);
          if (sent) {
            overlay.remove();
            return;
          }
        }
      }

      // if still not sent, notify user to manually paste
      window.alert("Text is on your clipboard. Please focus the input and press Ctrl/Cmd+V, then Enter.");
      overlay.remove();
    };

    closeBtn.onclick = () => overlay.remove();

    btnRow.appendChild(pasteBtn);
    btnRow.appendChild(closeBtn);
    overlay.appendChild(btnRow);
    document.body.appendChild(overlay);
  }

  /**************************************************************************
   * Main insertion flow
   **************************************************************************/
  (async () => {
    // candidate selectors for chat editors on modern web apps
    const editorSelectors = [
      "textarea[placeholder*='Message']",
      "textarea[placeholder*='Type']",
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='Talk']",
      "textarea[placeholder*='Send']",
      "textarea[aria-label*='Message']",
      "textarea[aria-label*='Compose']",
      "textarea",
      "div[contenteditable='true']",
      "div[role='textbox']",
      "div.ProseMirror",
      "div.ql-editor[contenteditable='true']",
      "div.public-DraftEditor-content",
      "div.slate-editor",
      "input[aria-label*='Message']",
      "input[placeholder*='Message']"
    ];

    // 1) try to find an editor immediately (document or same-origin frames)
    let found = findEditor(editorSelectors);

    // 2) If not found, wait a little for SPA components to initialize (apply MutationObserver for up to 6 seconds)
    if (!found) {
      let timedOut = false;
      const timeoutMs = 6000;
      const stopAt = Date.now() + timeoutMs;
      const observer = new MutationObserver(() => {
        if (Date.now() > stopAt) {
          timedOut = true;
          observer.disconnect();
          return;
        }
        const f = findEditor(editorSelectors);
        if (f) {
          found = f;
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
      // wait until found or timeout
      while (!found && !timedOut) {
        await sleep(200);
        if (Date.now() > stopAt) timedOut = true;
      }
    }

    // 3) If still not found, check if there are cross-origin frames (can't access)
    if (!found) {
      let sawCrossOrigin = false;
      for (let i = 0; i < window.frames.length; i++) {
        try {
          // access to frame.document will throw if cross-origin
          void window.frames[i].document;
        } catch (e) {
          sawCrossOrigin = true;
          break;
        }
      }

      // Write to clipboard (best-effort)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          console.log("Copied text to clipboard as fallback");
        } else {
          console.warn("Clipboard API not available");
        }
      } catch (e) {
        console.warn("clipboard write failed:", e);
      }

      // Show overlay telling user to paste manually (or allow them to paste via overlay)
      showOverlayClipboardFallback(text, null, null);

      if (sawCrossOrigin) {
        console.warn("Did not find editor and observed cross-origin frame(s). If Fetch.ai uses a cross-origin iframe, auto-insert is impossible from an extension content script.");
      } else {
        console.warn("No editor found and no cross-origin frame detected; maybe Fetch.ai uses a custom editor with unusual selectors. Inspect the page and add selector hints.");
      }
      return;
    }

    // we found an editor element (possibly in a same-origin iframe). Try to insert text.
    const editorEl = found.element;
    console.log("Found editor element:", editorEl, "in frame", found.frame === window ? 'main' : 'frame');

    // ensure we operate in the right document/context if it was in a same-origin iframe
    let contextDocument;
    try {
      contextDocument = (found.frame && found.frame.document) || document;
    } catch (e) {
      // should not happen if found by findEditor
      contextDocument = document;
    }

    // Step A: prefer native setter for inputs/textareas
    let success = false;
    if (editorEl.tagName === 'TEXTAREA' || editorEl.tagName === 'INPUT') {
      success = setInputValueNative(editorEl, text);
    } else if (editorEl.getAttribute && editorEl.getAttribute('contenteditable') === 'true' || editorEl.contentEditable === 'true' || editorEl.classList.contains('ProseMirror')) {
      success = setContentEditable(editorEl, text);
    } else {
      // last resort: try setting textContent
      try {
        editorEl.textContent = text;
        editorEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
        success = true;
      } catch (e) {
        console.warn("fallback textContent set failed:", e);
      }
    }

    if (!success) {
      console.warn("Failed to set text via DOM. Will attempt clipboard fallback.");
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        }
      } catch (e) {
        console.warn("clipboard write failed:", e);
      }
      showOverlayClipboardFallback(text, editorEl, null);
      return;
    }

    // Let the page react to changes
    await sleep(120);

    // Attempt to send
    const sent = await attemptSend(editorEl);
    if (sent) {
      console.log("Attempted send; done.");
      return;
    }

    // If we couldn't send automatically, present the overlay to let the user paste/send
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (e) {
      /* ignore */
    }
    showOverlayClipboardFallback(text, editorEl, null);
    console.log("Finished insertIntoFetchAI with fallback overlay shown.");
  })();
}