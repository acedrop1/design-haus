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

        if (!apiKey) {
            console.warn("[SERVER] No GOOGLE_API_KEY found, using fallback");
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=800",
                isMock: true
            };
        }

        // Try Vertex AI Imagen 3 (Google's official image generation)
        console.log("[SERVER] Using Vertex AI Imagen 3");

        const { VertexAI } = await import('@google-cloud/vertexai');

        // Initialize Vertex AI with API key authentication
        const vertexAI = new VertexAI({
            project: process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id',
            location: 'us-central1',
        });

        const model = vertexAI.preview.getGenerativeModel({
            model: 'imagen-3.0-generate-001',
        });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.4,
                topP: 0.95,
                topK: 32,
                maxOutputTokens: 2048,
            }
        });

        const response = result.response;
        const candidates = response.candidates;

        if (candidates && candidates[0]) {
            const parts = candidates[0].content.parts;
            const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image'));

            if (imagePart && imagePart.inlineData) {
                console.log("[SERVER] Successfully generated image with Imagen 3");
                return {
                    success: true,
                    imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
                    isMock: false
                };
            }
        }

        // If Vertex AI fails, fall back to themed images
        console.warn("[SERVER] Vertex AI didn't return image, using themed fallback");

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
