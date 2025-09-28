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

