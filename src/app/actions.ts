"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini for text generation (if needed for refinements)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function generatePackagingDesign(prompt: string, base64Image?: string) {
    console.log("🎨 [SERVER] generatePackagingDesign called with prompt:", prompt);

    try {
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            console.warn("[SERVER] No GOOGLE_API_KEY found, using mock image");
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
                isMock: true
            };
        }

        console.log("[SERVER] Using Google Imagen 3 API");

        // Enhanced prompt for packaging results
        const enhancedPrompt = `High quality product photography of a premium packaging design: ${prompt}. 
        Style: Modern, sleek, industrial aesthetic, bold typography. 
        Object: Physical product box or pouch. 
        Lighting: Studio lighting, 4k, photorealistic.`;

        // Using Gemini 2.5 Flash (as requested and available)
        const modelId = "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        console.log(`[SERVER] Calling Gemini Model: ${modelId}`);

        // Gemini Payload
        const payload = {
            contents: [{
                parts: [{
                    text: `Generate a photorealistic image of high quality product packaging. ${enhancedPrompt}`
                }]
            }]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[SERVER] ${modelId} API Error:`, response.status, errText);
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=600&auto=format&fit=crop",
                isMock: true,
                error: `API Call Failed: ${response.status} - ${errText}`
            };
        }

        const data = await response.json();

        // Check for Gemini Response (Inline Data)
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith("image"));
        const textPart = parts.find((p: any) => p.text);

        if (imagePart) {
            const base64Image = imagePart.inlineData.data;
            console.log(`[SERVER] Successfully generated image with ${modelId}`);
            return {
                success: true,
                imageUrl: `data:${imagePart.inlineData.mimeType};base64,${base64Image}`,
                isMock: false
            };
        } else {
            console.warn("[SERVER] No image in response. Text content:", textPart?.text || "None");
            console.log("[SERVER] Full response:", JSON.stringify(data).slice(0, 500));

            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
                isMock: true,
                error: textPart?.text ? `AI Refusal: ${textPart.text}` : "No image generated"
            };
        }

    } catch (error) {
        console.error("[SERVER] Generation logic failed:", error);
        return {
            success: true,
            imageUrl: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=600&auto=format&fit=crop",
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
