// -------------------------------
// Config
// -------------------------------
const MAX_TAG_LENGTH = 20;
const toneButtons = document.querySelectorAll('#tone-buttons .choice-btn');
const tagsContainer = document.getElementById('tags-container');
const addTagBtn = document.getElementById('add-tag-btn');
const newTagInput = document.getElementById('new-tag-input');
const maxCharsText = document.getElementById('max-chars-text');

maxCharsText.textContent = MAX_TAG_LENGTH;

// -------------------------------
// Helpers
// -------------------------------
async function saveSettings() {
    // Prompt Type (Tone)
    const selectedTone = document.querySelector('#tone-buttons .choice-btn.active')?.dataset.tone || '';
    await chrome.storage.local.set({ userTone: selectedTone });

    // Tags
    const tags = Array.from(tagsContainer.querySelectorAll('.tag'))
                      .map(t => t.textContent.replace('×','').trim());

    const tagItems = {};
    tagItems.userTagCount = tags.length;
    tags.forEach((tag, i) => tagItems[`userTag_${i}`] = tag);

    await chrome.storage.local.set(tagItems);

    console.log('Settings saved:', { tone: selectedTone, tags });
}


async function loadSettings() {
    const toneData = await chrome.storage.local.get('userTone');
    const savedTone = toneData.userTone || '';
    if(savedTone) {
        const btn = document.querySelector(`#tone-buttons .choice-btn[data-tone="${savedTone}"]`);
        if(btn) btn.classList.add('active');
    }

    const tagData = await chrome.storage.local.get(null); // get all keys
    const tagCount = parseInt(tagData.userTagCount || '0', 10);

    for(let i = 0; i < tagCount; i++) {
        const tag = tagData[`userTag_${i}`];
        if(tag) tagsContainer.appendChild(createTagElement(tag));
    }
}


function createTagElement(tagText) {
    if(tagText.length > MAX_TAG_LENGTH) tagText = tagText.substring(0, MAX_TAG_LENGTH) + '…';

    const span = document.createElement('span');
    span.classList.add('tag');

    const textSpan = document.createElement('span');
    textSpan.classList.add('tag-text');
    textSpan.textContent = tagText;

    const removeBtn = document.createElement('button');
    removeBtn.classList.add('remove-tag');
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
        tagsContainer.removeChild(span);
        saveSettings();
    });

    span.appendChild(textSpan);
    span.appendChild(removeBtn);
    return span;
}

function addTag() {
    const tagText = newTagInput.value.trim();
    if(tagText) {
        tagsContainer.appendChild(createTagElement(tagText));
        newTagInput.value = '';
        saveSettings(); // auto-save on add
    }
}

// -------------------------------
// Event Listeners
// -------------------------------
toneButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        toneButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveSettings();
    });
});

newTagInput.addEventListener('input', () => {
    if(newTagInput.value.length > MAX_TAG_LENGTH) {
        newTagInput.value = newTagInput.value.substring(0, MAX_TAG_LENGTH);
    }
});

addTagBtn.addEventListener('click', addTag);
newTagInput.addEventListener('keypress', e => {
    if(e.key === 'Enter') addTag();
});

window.addEventListener('DOMContentLoaded', loadSettings);
