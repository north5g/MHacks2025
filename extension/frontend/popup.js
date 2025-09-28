// Wait until document it fully loaded before trying to fetch local storage, not waiting can cause it to return nil
document.addEventListener("DOMContentLoaded", () => {
  const responseText = document.getElementById("responseText");
  const copyBtn = document.getElementById("copyBtn");

  if (!responseText || !copyBtn) return;

  // Load the last rewritten response from storage
  chrome.storage.local.get("lastRewritten").then(({ lastRewritten }) => {
    if (lastRewritten && lastRewritten.trim() !== "") {
      responseText.textContent = lastRewritten;
      copyBtn.disabled = false;
    }
  });

  // Copy button handler
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(responseText.textContent);
    window.close();
  });
});