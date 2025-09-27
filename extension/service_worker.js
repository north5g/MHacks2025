const OPTIONS = ["option1", "option2"]; // example options

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "smartrewrite_root",
    title: "AI Rewrite",
    contexts: ["selection"]
  });
  OPTIONS.forEach(id => {
    chrome.contextMenus.create({
      id,
      parentId: "smartrewrite_root",
      title: id[0].toUpperCase() + id.slice(1),
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selection = (info.selectionText || "").trim();
  const target = info.menuItemId;
  if (!selection) return;

  // get user settings (templates, apiKey, provider)
  const cfg = await chrome.storage.sync.get({
    provider: "gemini",
    apiKey: process.env.GEMINI_API_KEY,
    templates: {}
  });

  // build a prompt based on `target` and user templates
  const prompt = buildPromptForTarget(selection, target, cfg.templates);

  // generate text (call to provider or local method)
  let result;
  try {
    result = await callLLM(prompt, cfg);
  } catch (err) {
    chrome.notifications.create({title: "SmartRewrite error", message: String(err)});
    return;
  }

  // open a preview popup window (preview.html) and pass result
  await chrome.storage.session?.set?.({lastResult: result}) || chrome.storage.local.set({lastResult: result});
  chrome.windows.create({
    url: chrome.runtime.getURL("preview.html"),
    type: "popup",
    width: 600,
    height: 480
  });
});

async function callLLM(prompt, cfg) {
  // cfg.apiKey should be provided by the user in options (or server-side)
  if (!cfg.apiKey) throw new Error("No API key configured");

  // use app.py
  
  /* const body = {
    model: "gpt-4o-mini", // pick appropriate model
    messages: [{role: "user", content: prompt}],
    temperature: 0.2,
    max_tokens: 400
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + cfg.apiKey
    },
    body: JSON.stringify(body)
  }); */

  if (!res.ok) {
    const t = await res.text();
    throw new Error("LLM error: " + t);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "";
}

function insertIntoActiveElement(text) {
  const el = document.activeElement;
  if (!el) {
    // fallback: find first textarea/contenteditable
    const t = document.querySelector('textarea, [contenteditable="true"]');
    if (t) t.focus();
  }
  // For contenteditable
  if (document.activeElement && document.activeElement.isContentEditable) {
    document.activeElement.innerText = text;
  } else if (document.activeElement && 'value' in document.activeElement) {
    document.activeElement.value = text;
  } else {
    // last fallback: copy to clipboard and notify user
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard.");
  }
}