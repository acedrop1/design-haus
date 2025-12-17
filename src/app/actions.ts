"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini for text generation (if needed for refinements)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function generatePackagingDesign(prompt: string, base64Image?: string) {
    try {
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            console.warn("No GOOGLE_API_KEY found, using mock image");
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
                isMock: true
            };
        }

        console.log("Generating design using Google API Key for prompt:", prompt);

        // Enhanced prompt for packaging results
        const enhancedPrompt = `High quality product photography of a premium packaging design: ${prompt}. 
        Style: Modern, sleek, industrial aesthetic, bold typography. 
        Object: Physical product box or pouch. 
        Lighting: Studio lighting, 4k, photorealistic.`;

        // Attempting to use the Imagen model via Generative Language API (beta)
        // URL pattern for AI Studio keys targeting Imagen
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: enhancedPrompt
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "4:5"
                }
            })
        });

        if (!response.ok || true) { // FORCE MOCK FOR DEBUGGING
            const errText = !response.ok ? await response.text() : "Debug Mode";
            console.error("Google Image/Imagen API Error or Debug Fallback:", response.status, errText);

            // Helpful logging for the user if their key doesn't have permissions
            if (response.status === 404 || response.status === 400) {
                console.warn("Model likely not accessible with this API Key. Falling back to mock.");
            }

            // FALLBACK TO MOCK so the app doesn't break
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
                isMock: true,
                error: `API Call Failed: ${response.status}`
            };
        }

        const data = await response.json();

        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
            const base64Image = data.predictions[0].bytesBase64Encoded;
            return {
                success: true,
                imageUrl: `data:image/png;base64,${base64Image}`,
                isMock: false
            };
        } else {
            console.warn("Unexpected API response structure:", data);
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
                isMock: true,
                error: "Invalid API response structure"
            };
        }

    } catch (error) {
        console.error("Generation logic failed:", error);
        return {
            success: true,
            imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
            isMock: true,
            error: String(error)
        };
    }
}
