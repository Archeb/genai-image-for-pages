export async function onRequestPost({ request }) {
    try {
        const data = await request.json();
        const { apiKey, prompt, model, aspectRatio } = data;

        if (!apiKey || !prompt) {
            return new Response(JSON.stringify({ error: "API Key and Prompt are required." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const geminiModel = model || "gemini-3.1-flash-image-preview";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

        const requestBody = {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                responseModalities: ["IMAGE"]
            }
        };

        if (aspectRatio && aspectRatio !== "1:1") {
            requestBody.generationConfig.imageConfig = { aspectRatio };
        }

        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "x-goog-api-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        const responseData = await res.json();

        if (!res.ok) {
            return new Response(JSON.stringify({ error: responseData.error?.message || "Gemini API error" }), {
                status: res.status,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
