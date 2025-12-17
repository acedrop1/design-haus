"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini for text generation (if needed for refinements)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function generatePackagingDesign(prompt: string, base64Image?: string) {
    console.log("🎨 [SERVER] generatePackagingDesign called with prompt:", prompt);

    // TEMPORARY: Always use mock image to verify the flow works
    // This ensures designs appear in staging area while we debug API issues
    const mockImage = "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop";

    console.log("🎨 [SERVER] Returning mock image for testing");

    return {
        success: true,
        imageUrl: mockImage,
        isMock: true
    };

    /* REAL API CODE - Temporarily disabled for debugging
    try {
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            console.warn("No GOOGLE_API_KEY found, using mock image");
            return {
                success: true,
                imageUrl: mockImage,
                isMock: true
            };
        }

        console.log("Generating design using Google API Key for prompt:", prompt);

        const enhancedPrompt = `High quality product photography of a premium packaging design: ${prompt}. 
        Style: Modern, sleek, industrial aesthetic, bold typography. 
        Object: Physical product box or pouch. 
        Lighting: Studio lighting, 4k, photorealistic.`;

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

        if (!response.ok) {
            const errText = await response.text();
            console.error("Google Image/Imagen API Error:", response.status, errText);

            if (response.status === 404 || response.status === 400) {
                console.warn("Model likely not accessible with this API Key. Falling back to mock.");
            }

            return {
                success: true,
                imageUrl: mockImage,
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
                imageUrl: mockImage,
                isMock: true,
                error: "Invalid API response structure"
            };
        }

    } catch (error) {
        console.error("Generation logic failed:", error);
        return {
            success: true,
            imageUrl: mockImage,
            isMock: true,
            error: String(error)
        };
    }
    */
}

