import * as helper from "./helper.js";

const OPTIONS = [
  { id: "build_prompt", title: "Build Prompt", preset: "polish" },
  { id: "prompt_gpt", title: "Prompt ChatGPT", preset: "polish" },
  { id: "prompt_gemini", title: "Prompt Gemini", preset: "polish" },
  { id: "prompt_claude", title: "Prompt Claude", preset: "polish" },
  { id: "prompt_fetch", title: "Prompt Fetch.ai", preset: "polish" },
  { id: "settings", title: "Prompt Settings" },
];

const DEFAULT_ENDPOINT = "http://127.0.0.1:8000/rewrite"; // FastAPI endpoint

chrome.runtime.onInstalled.addListener(async () => {
  // selectable dropdown items
  for (const item of OPTIONS){
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: (item.id === "settings") ? ["page", "selection"] : ["selection"]
    });
  }

  // Seed backend endpoint if not set
  const got = await chrome.storage.sync.get({ endpoint: DEFAULT_ENDPOINT });
  await chrome.storage.sync.set({ endpoint: got.endpoint });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const target = info.menuItemId;
  console.log("Context menu clicked:", target, "Selected text:", info.selectionText);
  
  if (!tab?.id) return;
  
  if (target === "settings") {
    chrome.runtime.openOptionsPage();
    return;
  }
  
  const selection = (info.selectionText || "").trim();
  if (!selection) {
    console.log("No text selected");
    return;
  }

  try {
    await helper.notify("Hold on...", "We're processing your prompt now.")
    console.log("Calling backend with selection:", selection);
    const rewritten = await helper.callBackend(selection);
    console.log("Backend response:", rewritten);
    
    switch (target) {
      case "build_prompt":
        await chrome.storage.local.set({ lastRewritten: rewritten });
        await helper.notify("Success!", "Prompt saved.");

        // Open 'popup' window with response from Gemini so the user can copy to clipboard / review manually
        chrome.windows.create({
          url: chrome.runtime.getURL("frontend/popup.html"),
          type: "popup",
          width: 500,
          height: 700,
          focused: true
        });

        break;
      case "prompt_gpt":
        console.log("Pasting to ChatGPT:", rewritten);
        helper.pasteChatGpt(rewritten);
        break;

      case "prompt_gemini":
        console.log("Pasting to Gemini:", rewritten);
        helper.pasteGemini(rewritten);
        break;

      case "prompt_claude":
        console.log("Pasting to Claude:", rewritten);
        helper.pasteClaude(rewritten);
        break;

      case "prompt_fetch":
        console.log("Pasting to Fetch:", rewritten);
        helper.pasteFetchAI(rewritten);
        break;

      default:
        await helper.notify("Sorry!", "Something went wrong. Try again!")
        throw new Error("invalid target id");
    }
  }
  catch (err) {
    console.error("Backend error:", err);
    
    if (target === "prompt_gpt") {
      console.log("Backend failed, sending original text to ChatGPT");
      helper.pasteChatGpt(selection);
      await helper.notify("Backend Offline", "Sent original text to ChatGPT (backend unavailable)");

    } else if (target === "prompt_gemini") {
      console.log("Backend failed, sending original text to Gemini");
      helper.pasteGemini(selection);
      await helper.notify("Backend Offline", "Sent original text to Gemini (backend unavailable)");

    } else if (target === "prompt_claude") {
      console.log("Backend failed, sending original text to Claude");
      helper.pasteClaude(selection);
      await helper.notify("Backend Offline", "Sent original text to Claude (backend unavailable)");

    } else {
      await helper.notify("Error", `Backend error: ${String(err.message || err)}`);
    }
  }
});

