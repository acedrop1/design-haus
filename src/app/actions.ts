"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini for text generation (if needed for refinements)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function generatePackagingDesign(prompt: string, base64Image?: string) {
    console.log("🎨 [SERVER] generatePackagingDesign called with prompt:", prompt);

    // Enhanced prompt for packaging results
    const enhancedPrompt = `High quality product photography of a premium packaging design: ${prompt}. 
    Style: Modern, sleek, industrial aesthetic, bold typography. 
    Object: Physical product box or pouch on a clean background. 
    Lighting: Studio lighting, 4k, photorealistic, professional product shot.`;

    try {
        const apiKey = process.env.GOOGLE_API_KEY;
        const projectId = process.env.GOOGLE_CLOUD_PROJECT;

        if (!apiKey) {
            console.warn("[SERVER] No GOOGLE_API_KEY found, using fallback");
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=800",
                isMock: true
            };
        }

        // Try direct Imagen API (works with API key)
        if (projectId) {
            console.log("[SERVER] Trying Vertex AI Imagen via REST API");

            const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    instances: [{
                        prompt: enhancedPrompt
                    }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "4:5",
                        safetyFilterLevel: "block_some",
                        personGeneration: "allow_adult"
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.predictions && data.predictions[0]?.bytesBase64Encoded) {
                    console.log("[SERVER] Successfully generated image with Imagen 3");
                    return {
                        success: true,
                        imageUrl: `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`,
                        isMock: false
                    };
                }
            } else {
                const errorText = await response.text();
                console.warn("[SERVER] Imagen API error:", response.status, errorText);
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
