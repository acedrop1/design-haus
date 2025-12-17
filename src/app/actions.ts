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
        const replicateKey = process.env.REPLICATE_API_TOKEN;

        if (replicateKey) {
            console.log("[SERVER] Using Replicate FLUX model for image generation");

            const response = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${replicateKey}`,
                    "Content-Type": "application/json",
                    "Prefer": "wait"
                },
                body: JSON.stringify({
                    version: "black-forest-labs/flux-schnell",
                    input: {
                        prompt: enhancedPrompt,
                        aspect_ratio: "4:5",
                        output_format: "png",
                        output_quality: 90
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.output && data.output[0]) {
                    console.log("[SERVER] Successfully generated image with FLUX");
                    return {
                        success: true,
                        imageUrl: data.output[0],
                        isMock: false
                    };
                }
            } else {
                console.warn("[SERVER] Replicate API failed:", response.status);
            }
        }

        // Fallback: Try Google API if available
        const googleKey = process.env.GOOGLE_API_KEY;
        if (googleKey) {
            console.log("[SERVER] Trying Google Gemini for text description");

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(
                `You are a packaging design expert. Describe in vivid detail what a ${prompt} product packaging would look like. Focus on colors, typography, materials, and overall aesthetic. Be specific and visual.`
            );

            const description = result.response.text();
            console.log("[SERVER] Generated description:", description.slice(0, 100));

            // For now, return a curated stock image that matches the theme
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
                description
            };
        }

        // Final fallback
        console.warn("[SERVER] No API keys available, using fallback image");
        return {
            success: true,
            imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=800",
            isMock: true
        };

    } catch (error) {
        console.error("[SERVER] Generation failed:", error);
        return {
            success: true,
            imageUrl: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=800",
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
