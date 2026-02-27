// --- IndexedDB for History Management ---
const DB_NAME = 'GeminiHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onerror = (e) => reject(e.target.error);
    });
}

function saveToHistory(item) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(item);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function getAllHistory() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.sort((a, b) => b.timestamp - a.timestamp));
        request.onerror = (e) => reject(e.target.error);
    });
}

function deleteFromHistory(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function clearAllHistoryDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- App Logic ---
document.addEventListener('DOMContentLoaded', async () => {
    // Dom Elements
    const apiKeyInput = document.getElementById('api-key');
    const generateBtn = document.getElementById('generate-btn');
    const promptInput = document.getElementById('prompt');
    const modelSelect = document.getElementById('model');
    const ratioSelect = document.getElementById('aspect-ratio');

    // Stage Elements
    const imageStage = document.getElementById('image-stage');
    const emptyState = document.getElementById('empty-state');
    const mainImage = document.getElementById('main-image');
    const mainImageControls = document.getElementById('main-image-controls');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorMsg = document.getElementById('error-message');
    const mainDownloadBtn = document.getElementById('main-download-btn');

    // Sidebar Elements
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    const clearAllBtn = document.getElementById('clear-all-btn');

    // Init DB & Load state
    try {
        await initDB();
        await renderHistory();
    } catch (err) {
        console.error("Failed to init IndexedDB:", err);
    }

    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) apiKeyInput.value = savedApiKey;

    // Actions
    function setDisplayImage(url, downloadName) {
        mainImage.src = url;
        mainDownloadBtn.href = url;
        mainDownloadBtn.download = downloadName || `gemini_${Date.now()}.jpg`;

        emptyState.classList.add('hidden');
        mainImage.classList.remove('hidden');
        mainImageControls.classList.remove('hidden');
    }

    async function renderHistory() {
        if (!db) return;
        const items = await getAllHistory();
        historyList.innerHTML = '';

        if (items.length === 0) {
            historyEmpty.style.display = 'block';
            historyList.appendChild(historyEmpty);
            return;
        }

        historyEmpty.style.display = 'none';

        items.forEach(item => {
            const date = new Date(item.timestamp).toLocaleDateString();

            const el = document.createElement('div');
            el.className = 'history-item';

            el.innerHTML = `
                <img src="${item.url}" class="history-thumb" alt="History thumbnail">
                <div class="history-actions">
                    <a href="${item.url}" download="${item.filename}" class="icon-btn" title="Download">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </a>
                    <button class="icon-btn delete-btn" data-id="${item.id}" title="Delete">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                <div class="history-info">
                    <div class="history-prompt">${item.prompt}</div>
                    <div class="history-meta">
                        <span>${item.model}</span>
                        <span>${date}</span>
                    </div>
                </div>
            `;

            // Set image to main stage on click
            el.querySelector('.history-thumb').addEventListener('click', () => {
                setDisplayImage(item.url, item.filename);
                // Also visually scroll top
                document.getElementById('image-stage').scrollIntoView({ behavior: 'smooth' });
            });

            // Delete
            el.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Delete this image?')) {
                    await deleteFromHistory(item.id);
                    renderHistory();
                }
            });

            historyList.appendChild(el);
        });
    }

    clearAllBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all history?')) {
            await clearAllHistoryDB();
            renderHistory();

            // Reset main stage
            mainImage.classList.add('hidden');
            mainImageControls.classList.add('hidden');
            emptyState.classList.remove('hidden');
            mainImage.src = '';
        }
    });

    generateBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const model = modelSelect.value;
        const aspectRatio = ratioSelect.value;
        const prompt = promptInput.value.trim();

        if (!apiKey || !prompt) {
            alert("Please provide both API Key and a Prompt.");
            return;
        }

        localStorage.setItem('gemini_api_key', apiKey);

        // UI State: Loading
        generateBtn.disabled = true;
        loadingOverlay.classList.remove('hidden');
        errorMsg.classList.add('error-hidden');

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, model, aspectRatio, prompt })
            });

            const data = await response.json();

            if (!response.ok) {
                const errDetail = data.error?.message || data.error || "Unknown error occurred";
                throw new Error(errDetail);
            }

            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].inlineData) {
                const mimeType = data.candidates[0].content.parts[0].inlineData.mimeType;
                const base64Data = data.candidates[0].content.parts[0].inlineData.data;
                const imageUrl = `data:${mimeType};base64,${base64Data}`;
                const filename = `gemini_${Date.now()}.jpg`;

                // Show generated image
                setDisplayImage(imageUrl, filename);

                // Save to IndexedDB history
                if (db) {
                    await saveToHistory({
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        url: imageUrl,
                        prompt: prompt,
                        model: model,
                        filename: filename
                    });
                    renderHistory();
                }

                // Auto-clear prompt on success to encourage next gen
                promptInput.value = '';

            } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error("Model returned text. Ensure you are using the correct Image model.");
            } else {
                throw new Error("No image data found in response.");
            }

        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.classList.remove('error-hidden');
        } finally {
            // UI State: Rest
            generateBtn.disabled = false;
            loadingOverlay.classList.add('hidden');
        }
    });
});
