
const OPTIONS = [
  { id: "smart_rewrite", title: "Smart Rewrite", preset: "polish" },
  { id: "rewrite_chatgpt", title: "Rewrite for ChatGPT", preset: "polish" },
  { id: "rewrite_gemini", title: "Rewrite for Gemini", preset: "polish" },
  { id: "settings", title: "Settings" },
];

const MENU_ROOT = "smartrewrite_root";
const DEFAULT_ENDPOINT = "http://127.0.0.1:8000/rewrite"; // FastAPI endpoint

chrome.runtime.onInstalled.addListener(async () => {
  // Root menu
  chrome.contextMenus.create({
    id: MENU_ROOT,
    title: "AI Rewrite",
    contexts: ["selection"]
  });

  // Child items
  for (const item of OPTIONS){
    chrome.contextMenus.create({
      id: item.id,
      parentId: MENU_ROOT,
      title: item.title,
      contexts: ["selection"]
    });
  }

  // Seed backend endpoint if not set
  const got = await chrome.storage.sync.get({ endpoint: DEFAULT_ENDPOINT });
  await chrome.storage.sync.set({ endpoint: got.endpoint });
});


async function callBackend(text, preset) {
  const { endpoint } = await chrome.storage.sync.get({ endpoint: DEFAULT_ENDPOINT });
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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selection = (info.selectionText || "").trim();
  const target = info.menuItemId;
  if (!selection || !tab?.id) return;

  if (target === "settings") {
    chrome.runtime.openOptionsPage();
    return;
  }

  const preset = OPTIONS.find(p => p.id === target)?.preset;
  if (!preset) return; // not a rewrite item

  try {
    const rewritten = await callBackend(selection, preset);

    // Try to replace in-page via content script
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "REPLACE_SELECTION", rewritten });
      await notify("AI Rewrite", "Rewritten text inserted.");
    } 
    catch (e){
      // Fallback: copy to clipboard from the page context
      await chrome.scripting.executeScript({
        target: { tabId: tab.id},
        func: (t) => navigator.clipboard.writeText(t),
        args: [rewritten]
      });
      await notify("AI Rewrite", "Copied rewritten text to clipboard (no content script).");
    }
  }
  catch (err) {
    console.error(err);
    await notify("AI Rewrite", `Error: ${String(err.message || err)}`);
  }
});

function notify(title, message) {
  return new Promise((resolve) => {
    chrome.notifications?.create(
      {
        type: "basic",
        iconUrl: "icon128.png",
        title,
        message
      },
      resolve
    );
  });
}

function pasteChatGpt(text) {
  chrome.tabs.create(
    {
      url: "https://chat.openai.com/",
      active: true
    },
    (newTab) => {
      chrome.scripting.executeScript({
        target: { tabId: newTab.id },
        func: insertIntoChatGpt,
        args: [text]
      });
    }
  );
}

function insertIntoChatGpt(text) {
  const editor = document.querySelector("textarea#prompt-textarea");
  if (editor) {
    editor.value = text;

    editor.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    console.log("ChatGPT editor not found!");
  }
}

function pasteGemini(text) {
  chrome.tabs.create(
    {
      url: "https://gemini.google.com/",
      active: true
    },
    (newTab) => {
      chrome.scripting.executeScript({
        target: { tabId: newTab.id },
        function: insertIntoGemini,
        args: [text]
      });
    }
  );
}

function insertIntoGemini(text) {
    const editor = document.querySelector("rich-textarea");
    if (editor) {
        // Replace its contents
        editor.value = text;

        // Make sure React knows it changed
        const inputEvent = new Event("input", { bubbles: true });
        editor.dispatchEvent(inputEvent);
    } else{
        console.log("Gemini editor not found!");
    }
}
