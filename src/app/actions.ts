"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini for text generation (if needed for refinements)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function generatePackagingDesign(prompt: string, base64Image?: string) {
    try {
        // Check if we have a valid API key
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey || apiKey === "") {
            console.warn("No GOOGLE_API_KEY found, using mock image");
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
                isMock: true
            };
        }

        // Enhanced prompt for packaging design
        const enhancedPrompt = `Create a premium, professional packaging design for: ${prompt}. 
Style: Modern, sleek, industrial aesthetic with bold typography. 
Format: Product packaging box or label, 4:5 aspect ratio.
Include: Brand name, product description, eye-catching graphics.
Quality: High-resolution, print-ready, commercial quality.`;

        console.log("Generating design with Imagen 3 for:", prompt);

        // Call Imagen 3 via Vertex AI REST API
        // Note: This requires Vertex AI to be enabled in your Google Cloud project
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || "your-project-id";
        const location = "us-central1";

        const response = await fetch(
            `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    instances: [
                        {
                            prompt: enhancedPrompt,
                        }
                    ],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "4:5",
                        negativePrompt: "blurry, low quality, pixelated, amateur, unprofessional",
                        safetySetting: "block_some",
                    }
                })
            }
        );

        if (!response.ok) {
            console.error("Imagen 3 API error:", response.status, await response.text());
            // Fallback to mock
            return {
                success: true,
                imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
                isMock: true,
                error: "API error, using fallback"
            };
        }

        const data = await response.json();

        // Extract base64 image from response
        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
            const base64Image = data.predictions[0].bytesBase64Encoded;
            const imageUrl = `data:image/png;base64,${base64Image}`;

            return {
                success: true,
                imageUrl: imageUrl,
                isMock: false
            };
        }

        // Fallback if response format is unexpected
        console.warn("Unexpected Imagen 3 response format, using mock");
        return {
            success: true,
            imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
            isMock: true
        };

    } catch (error) {
        console.error("Imagen 3 Generation Error:", error);
        // Fallback to mock on any error
        return {
            success: true,
            imageUrl: "https://images.unsplash.com/photo-1633053699042-45e053eb813d?q=80&w=2670&auto=format&fit=crop",
            isMock: true,
            error: String(error)
        };
    }
}
