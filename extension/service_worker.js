const { option } = require("lightbox2");

const OPTIONS = [
  { id: "smart_rewrite", title: "Smart Rewrite" },
  { id: "rewrite_chatgpt", title: "Rewrite for ChatGPT" },
  { id: "rewrite_gemini", title: "Rewrite for Gemini" },
  { id: "settings", title: "Settings" },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "smartrewrite_root",
    title: "AI Rewrite",
    contexts: ["selection"]
  });
  OPTIONS.forEach(option => {
    chrome.contextMenus.create({
      id: option.id,
      parentId: "smartrewrite_root",
      title: option.title,
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selection = (info.selectionText || "").trim();
  const target = info.menuItemId;
  if (!selection) return;

  switch (targetID) {
    case "smart_rewrite":
      callLLM();
      break;
    case "rewrite_gemini":
      prompt = `Rewrite the following text to be more suitable for input to Gemini AI:\n\n"${selection}"\n\nRewritten version:`;
      break;
    case "settings":
      chrome.runtime.openOptionsPage();
      return;
    default:
      return;
  }

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
    type: "panel",
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

