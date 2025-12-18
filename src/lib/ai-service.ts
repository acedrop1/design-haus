import { getImagenModel } from "firebase/ai";
import { vertexAI } from "./firebase";

export const AIService = {
    async generateImage(prompt: string): Promise<{ success: boolean; imageUrl: string; error?: string }> {
        const tryGenerate = async (modelId: string) => {
            console.log(`🎨 [CLIENT] Attempting generation with ${modelId}...`);
            const model = getImagenModel(vertexAI, { model: modelId });

            const enhancedPrompt = `A stunning, high-definition, professional graphic design of ${prompt}. Clean background, studio lighting, award-winning packaging aesthetic, 8k resolution, photorealistic, premium feel.`;

            return await (model as any).generateImages({
                prompt: enhancedPrompt,
                aspectRatio: "1:1",
                addWatermark: false,
            });
        };

        try {
            let result;
            try {
                result = await tryGenerate("imagen-3.0-generate-002");
            } catch (err: any) {
                console.warn("⚠️ [CLIENT] Model 002 failed, falling back to 001:", err);
                result = await tryGenerate("imagen-3.0-generate-001");
            }

            // Inspect response
            const images = result.images;
            if (images && images.length > 0) {
                const image = images[0];
                console.log("✅ [CLIENT] Image generated successfully");

                // The image format in result.images is typically a Blobs or base64
                // We want the data URL
                return {
                    success: true,
                    imageUrl: image.url // This should be the direct data URL or reachable URL
                };
            }

            console.warn("⚠️ [CLIENT] No images in result array");
            throw new Error("No image data in response");

        } catch (error: any) {
            console.error("❌ [CLIENT] Vertex AI generation failed:", error);

            // Detailed error logging for debugging
            if (error.message?.includes('403')) {
                console.error("🔒 Auth Fail: Ensure Vertex AI in Firebase is enabled and App Check is configured if enforced.");
            } else if (error.message?.includes('404')) {
                console.error("📍 Model Fail: imagen-3.0-generate-002 might not be available in your region yet.");
            }

            return {
                success: false,
                imageUrl: "",
                error: error.message || String(error)
            };
        }
    }
};
