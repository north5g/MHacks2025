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


export function pasteChatGpt(text) {
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

export function insertIntoChatGpt(text) {
  const editor = document.querySelector("textarea#prompt-textarea");
  if (editor) {
    editor.value = text;

    editor.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    console.log("ChatGPT editor not found!");
  }
}

export function pasteGemini(text) {
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

export function insertIntoGemini(text) {
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
