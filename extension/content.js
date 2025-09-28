// Three states : pasting in 
switch (targetID) {
    case "smart_rewrite":
      insertIntoActiveElement(result);
      break;
    case "rewrite_chatgpt":
      prompt = `Rewrite the following text to be more suitable for input to ChatGPT:\n\n"${selection}"\n\nRewritten version:`;
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