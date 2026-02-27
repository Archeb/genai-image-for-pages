document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('generate-form');
    const generateBtn = document.getElementById('generate-btn');
    const loader = document.getElementById('loader');
    const btnText = document.querySelector('.btn-text');
    const resultContainer = document.getElementById('result-container');
    const imageWrapper = document.getElementById('image-wrapper');
    const errorMsg = document.getElementById('error-message');
    const downloadBtn = document.getElementById('download-btn');

    // Load API Key from local storage if available
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
        document.getElementById('api-key').value = savedApiKey;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const apiKey = document.getElementById('api-key').value.trim();
        const model = document.getElementById('model').value;
        const aspectRatio = document.getElementById('aspect-ratio').value;
        const prompt = document.getElementById('prompt').value.trim();

        if (!apiKey || !prompt) return;

        // Save API key
        localStorage.setItem('gemini_api_key', apiKey);

        // UI State: Loading
        generateBtn.disabled = true;
        btnText.textContent = "Generating...";
        loader.classList.remove('loader-hidden');
        resultContainer.classList.add('hidden');
        errorMsg.classList.add('error-hidden');
        imageWrapper.innerHTML = '';

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey,
                    model,
                    aspectRatio,
                    prompt
                })
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

                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = "Generated Image";
                imageWrapper.appendChild(img);

                downloadBtn.href = imageUrl;
                downloadBtn.download = `gemini_${Date.now()}.jpg`;

                resultContainer.classList.remove('hidden');
            } else if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
                throw new Error("Model returned text instead of an image. Ensure you are using the correct model. Response: " + data.candidates[0].content.parts[0].text);
            } else {
                throw new Error("No image data found in response.");
            }

        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.classList.remove('error-hidden');
        } finally {
            // UI State: Reset
            generateBtn.disabled = false;
            btnText.textContent = "Inspire Creation";
            loader.classList.add('loader-hidden');
        }
    });
});
