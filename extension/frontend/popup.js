const responseText = document.getElementById("responseText");
const replaceBtn = document.getElementById("replaceBtn");
const copyBtn = document.getElementById("copyBtn");

// Load the last rewritten response from storage
chrome.storage.local.get("lastRewritten").then(({ lastRewritten }) => {
  if (lastRewritten && lastRewritten.trim() !== "") {
    responseText.textContent = lastRewritten;
    replaceBtn.disabled = false;
    copyBtn.disabled = false;
  }
});

replaceBtn.addEventListener("click", () => {
  // Example: insert into active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (text) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
      },
      args: [responseText.textContent],
    });
  });
});

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(responseText.textContent);
});
