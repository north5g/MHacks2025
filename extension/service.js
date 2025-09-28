const OPTIONS = [
  { id: "build_prompt", title: "Build Prompt", preset: "polish" },
  { id: "prompt_gpt", title: "Prompt ChatGPT", preset: "polish" },
  { id: "prompt_gemini", title: "Prompt Gemini", preset: "polish" },
  { id: "settings", title: "Settings" },
];

const MENU_ROOT = "menu_root";
const DEFAULT_ENDPOINT = "http://127.0.0.1:8000/rewrite"; // FastAPI endpoint

chrome.runtime.onInstalled.addListener(async () => {
  // selectable dropdown items
  for (const item of OPTIONS){
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: (item.id === "settings") ? ["page"] : ["selection"]
    });
  }

  // Seed backend endpoint if not set
  const got = await chrome.storage.sync.get({ endpoint: DEFAULT_ENDPOINT });
  await chrome.storage.sync.set({ endpoint: got.endpoint });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const target = info.menuItemId;
  if (!tab?.id) return;
  
  if (target === "settings") {
    chrome.runtime.openOptionsPage();
    return;
  }
  
  const selection = (info.selectionText || "").trim();
  if (!selection) return;

  const preset = OPTIONS.find(p => p.id === target)?.preset;
  if (!preset) return; // not a rewrite item

  try {
    const rewritten = await callBackend(selection, preset);
    // ToDo : parse rewritten json for result text
    
    // Three states : pasting in 
    switch (target) {
      case "build_prompt":
        copyClipboard(rewritten);
        giveNotification();
        break;
      case "prompt_gpt":
        pasteChatGpt(rewritten);
        break;
      case "prompt_gemini":
        pasteGemini(rewritten);
        break;
      default:
        throw new Error("invalid target id");
    }
  }
  catch (err) {
    console.error(err);
    await notify("ToDo", `Error: ${String(err.message || err)}`);
  }
});

