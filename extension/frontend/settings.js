// Tone button toggle
const toneButtons = document.querySelectorAll('#tone-buttons .choice-btn');
toneButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        toneButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        console.log('Selected Tone:', btn.dataset.tone);
    });
});

// Tag management
const tagsContainer = document.getElementById('tags-container');
const addTagBtn = document.getElementById('add-tag-btn');
const newTagInput = document.getElementById('new-tag-input');

const MAX_TAG_LENGTH = 20;
document.getElementById('max-chars-text').textContent = MAX_TAG_LENGTH;

function createTagElement(tagText) {
    if(tagText.length > MAX_TAG_LENGTH) {
        tagText = tagText.substring(0, MAX_TAG_LENGTH) + '…';
    }

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
    });

    span.appendChild(textSpan);
    span.appendChild(removeBtn);
    return span;
}

// Limit typing in input when we hit MAX_TAG_LENGTH
newTagInput.addEventListener('input', () => {
    if(newTagInput.value.length > MAX_TAG_LENGTH) {
        newTagInput.value = newTagInput.value.substring(0, MAX_TAG_LENGTH);
    }
});

addTagBtn.addEventListener('click', () => {
    const tagText = newTagInput.value.trim();
    if(tagText) {
        tagsContainer.appendChild(createTagElement(tagText));
        newTagInput.value = '';
    }
});

// 'Enter' key support for 'Add a tag'
newTagInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') addTagBtn.click();
});

function addTag() {
    const tagText = newTagInput.value.trim();
    if(tagText) {
        tagsContainer.appendChild(createTagElement(tagText));
        newTagInput.value = '';
    }
}

addTagBtn.addEventListener('click', addTag);
newTagInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') addTag();
});

// Save settings (log to console for now)
document.getElementById('save-settings-btn').addEventListener('click', () => {
    const selectedTone = document.querySelector('#tone-buttons .choice-btn.active')?.dataset.tone || null;
    const tags = Array.from(tagsContainer.querySelectorAll('.tag')).map(t => t.textContent.replace('×','').trim());
    console.log('Settings Saved:', {tone: selectedTone, tags});
});