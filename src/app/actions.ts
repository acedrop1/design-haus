"use server";

import OpenAI from "openai";

export async function generatePackagingDesign(prompt: string, base64Image?: string) {
    console.log("🎨 [SERVER] generatePackagingDesign called with prompt:", prompt);

    // Enhanced prompt for packaging results
    const enhancedPrompt = `High quality product photography of a premium packaging design: ${prompt}. Modern, sleek, industrial aesthetic, bold typography. Physical product box or pouch on clean background. Studio lighting, 4k, photorealistic, professional product shot.`;

    try {
        // Try OpenAI DALL-E 3
        const openaiKey = process.env.OPENAI_API_KEY;

        if (openaiKey) {
            console.log("[SERVER] Using OpenAI DALL-E 3");

            const openai = new OpenAI({ apiKey: openaiKey });

            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: enhancedPrompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
                response_format: "b64_json"
            });

            if (response.data[0].b64_json) {
                console.log("[SERVER] Successfully generated image with OpenAI DALL-E 3");
                return {
                    success: true,
                    imageUrl: `data:image/png;base64,${response.data[0].b64_json}`,
                    isMock: false
                };
            }
        }

        // Fallback to themed images
        console.log("[SERVER] Using themed fallback images");

        const themeImages: Record<string, string> = {
            "ice cream": "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=800",
            "coca": "https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=800",
            "holiday": "https://images.unsplash.com/photo-1512909006721-3d6018887383?q=80&w=800",
            "default": "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=800"
        };

        const lowerPrompt = prompt.toLowerCase();
        let selectedImage = themeImages.default;

        for (const [key, url] of Object.entries(themeImages)) {
            if (lowerPrompt.includes(key)) {
                selectedImage = url;
                break;
            }
        }

        return {
            success: true,
            imageUrl: selectedImage,
            isMock: true
        };

    } catch (error) {
        console.error("[SERVER] Generation failed:", error);

        // Smart fallback based on prompt
        const themeImages: Record<string, string> = {
            "ice cream": "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=800",
            "coca": "https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=800",
            "holiday": "https://images.unsplash.com/photo-1512909006721-3d6018887383?q=80&w=800",
            "default": "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=800"
        };

        const lowerPrompt = prompt.toLowerCase();
        let selectedImage = themeImages.default;

        for (const [key, url] of Object.entries(themeImages)) {
            if (lowerPrompt.includes(key)) {
                selectedImage = url;
                break;
            }
        }

        return {
            success: true,
            imageUrl: selectedImage,
            isMock: true,
            error: String(error)
        };
    }
}

export async function listAvailableModels() {
    console.log("🔍 [SERVER] Listing available models...");
    try {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return { error: "No API Key" };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        const names = data.models?.map((m: any) => m.name) || [];
        console.log("🔍 [SERVER] Models available (NAMES ONLY):", JSON.stringify(names, null, 2));
        return names;
    } catch (error) {
        console.error("🔍 [SERVER] Failed to list models:", error);
        return { error: String(error) };
    }
}

export async function listAvailableModels() {
    console.log("🔍 [SERVER] Listing available models...");
    try {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return { error: "No API Key" };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        const names = data.models?.map((m: any) => m.name) || [];
        console.log("🔍 [SERVER] Models available (NAMES ONLY):", JSON.stringify(names, null, 2));
        return names;
    } catch (error) {
        console.error("🔍 [SERVER] Failed to list models:", error);
        return { error: String(error) };
    }
}
