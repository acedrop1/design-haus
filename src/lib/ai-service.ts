import { getGenerativeModel } from "firebase/vertexai";
import { vertexAI } from "./firebase";

export const AIService = {
    async generateImage(prompt: string): Promise<{ success: boolean; imageUrl: string; error?: string }> {
        console.log("🎨 [CLIENT] Generating image with Firebase Vertex AI (Imagen 3)");

        try {
            // Initialize Imagen 3 model
            const model = getGenerativeModel(vertexAI, { model: "imagen-3.0-generate-001" });

            // Generate content
            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{
                        text: `High quality product photography of a premium packaging design: ${prompt}. Modern, sleek, industrial aesthetic, bold typography. Physical product box or pouch on clean background. Studio lighting, 4k, photorealistic.`
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

            // Check for image in response (structure may vary for Imagen)
            // Note: Current Firebase JS SDK for Vertex AI primarily supports text/multimodal GEMINI.
            // Direct Imagen support is very new. If this structure mismatch occurs, we fallback.

            // Inspect candidates
            const candidates = response.candidates;
            if (candidates && candidates[0]) {
                const parts = candidates[0].content.parts;
                // Look for inline data (base64 image)
                const imagePart = parts.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('image'));

                if (imagePart && imagePart.inlineData) {
                    console.log("✅ [CLIENT] Image generated successfully");
                    return {
                        success: true,
                        imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
                    };
                }
            }

            console.warn("⚠️ [CLIENT] No image found in response, falling back to server");
            throw new Error("No image data in response");

        } catch (error) {
            console.error("❌ [CLIENT] Vertex AI generation failed:", error);

            // Fallback to server action (which has the themed logic)
            // Importing dynamically to avoid server-on-client issues if any
            // For now, return error to trigger fallback in UI
            return {
                success: false,
                imageUrl: "",
                error: (error as Error).message
            };
        }
    }
};
