import { getImagenModel } from "firebase/ai";
import { vertexAI } from "./firebase";

export const AIService = {
    async generateImage(prompt: string): Promise<{ success: boolean; imageUrl: string; error?: string }> {
        console.log("🎨 [CLIENT] Generating image with Firebase Vertex AI (Imagen 3.0 Generate 001)");

        try {
            // Initialize Imagen 3 model (Stable version)
            const model = getImagenModel(vertexAI, {
                model: "imagen-3.0-generate-001"
            });

            const enhancedPrompt = `High quality product photography of a premium packaging design: ${prompt}. Modern, sleek, industrial aesthetic, bold typography. Physical product box or pouch on clean background. Studio lighting, 4k, photorealistic, professional product shot.`;

            // Generate images (using method on model)
            const result = await (model as any).generateImages({
                prompt: enhancedPrompt,
                aspectRatio: "4:5",
                addWatermark: false,
            });

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
