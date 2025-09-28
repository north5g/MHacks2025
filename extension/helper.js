const FALLBACK_ENDPOINT = "http://127.0.0.1:8000/rewrite";

export async function callBackend(text, preset) {
  const { endpoint } = await chrome.storage.sync.get({ endpoint: FALLBACK_ENDPOINT });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, style: preset })
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
  
  // Updated selectors for current ChatGPT interface (as of 2024)
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
        
        // Method 1: Direct value assignment
        editor.value = text;
        
        // Method 2: React synthetic events (important for React apps)
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeInputValueSetter.call(editor, text);
        
        // Dispatch multiple events to ensure React picks up the change
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
        
        // Focus and trigger additional events
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
  chrome.tabs.create(
    {
      url: "https://gemini.google.com/",
      active: true
    },
    (newTab) => {
      // Wait for the tab to finish loading before injecting the script
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Add a small additional delay to ensure Gemini's components are ready
          setTimeout(() => {
            chrome.scripting.executeScript({
              target: { tabId: newTab.id },
              func: insertIntoGemini,
              args: [text]
            });
          }, 1000);
        }
      });
    }
  );
}

export function insertIntoGemini(text) {
  // Try multiple selectors as Gemini's interface may change
  const selectors = [
    "rich-textarea",
    "textarea[placeholder*='Enter a prompt']",
    "div[contenteditable='true']",
    "textarea"
  ];
  
  let editor = null;
  for (const selector of selectors) {
    editor = document.querySelector(selector);
    if (editor) break;
  }
  
  if (editor) {
    // For rich-textarea or regular textarea elements
    if (editor.tagName === 'RICH-TEXTAREA' || editor.tagName === 'TEXTAREA') {
      editor.value = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } 
    // For contenteditable divs
    else if (editor.contentEditable === 'true') {
      editor.textContent = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    
    // Focus the editor to show the text was inserted
    editor.focus();
    console.log("Text successfully inserted into Gemini!");
  } else {
    console.log("Gemini editor not found! Retrying in 2 seconds...");
    // Retry after 2 seconds if not found
    setTimeout(() => insertIntoGemini(text), 2000);
  }
}
