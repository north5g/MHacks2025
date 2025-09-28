// Three states : pasting in 
switch (targetID) {
    case "smart_rewrite":
      insertIntoActiveElement(result);
      break;
    case "rewrite_chatgpt":
      pasteChatGpt(prompt);
      break;
    case "rewrite_gemini":
      pasteGemini(prompt);
      break;
    case "settings":
      chrome.runtime.openOptionsPage();
      return;
    default:
      return;
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
