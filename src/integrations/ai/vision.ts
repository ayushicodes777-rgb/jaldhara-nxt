import { GoogleGenerativeAI } from "@google/generative-ai";
import { ImageAnalysisResult } from "@/components/ui/image-analysis";

export class VisionAI {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Google Generative AI API key is required");
    }
    console.log(
      "Initializing Vision AI with API key:",
      apiKey ? "Present" : "Missing",
    );
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });
    console.log("Vision AI model initialized:", "gemini-1.5-flash");
  }

  async analyzeImage(imageFile: File): Promise<ImageAnalysisResult> {
    try {
      console.log("Analyzing image:", imageFile.name);
      // Convert file to base64
      const base64Image = await this.fileToBase64(imageFile);
      console.log("Image converted to base64, length:", base64Image.length);
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: imageFile.type,
        },
      };

      const prompt = `Analyze this image and determine if it shows farming or agricultural activities, and/or sun/solar content.

Respond with ONLY this JSON format:
{"isFarmRelated": true/false, "isSunRelated": true/false, "confidence": 0.0-1.0, "description": "what you see", "category": "farm/sun/farm_sun/other", "issues": [], "formData": {"location": null, "currentCrops": [], "soilType": null, "waterSource": null, "currentIrrigationMethod": null, "soilMoisture": null, "cropRotationPattern": null, "majorChallenges": null, "harvestSeason": null, "fertilizerType": null}}

Be conservative - only mark as farm/sun related if you're confident (0.7+). For formData, only include values you can clearly see.`;

      console.log("🔄 Sending request to AI model...");
      const result = await this.model.generateContent([prompt, imagePart]);
      console.log("✅ AI model generated content");
      const response = await result.response;
      console.log("✅ Received response from AI");
      const text = response.text();
      console.log("✅ Extracted text from response");

      console.log("Raw AI Response:", text);
      console.log(
        "Image file analyzed:",
        imageFile.name,
        "Type:",
        imageFile.type,
      );

      // Parse the JSON response
      try {
        // Clean the response text to remove potential backticks and extra whitespace
        let cleanedText = text.trim();

        // Remove markdown code blocks if present
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText
            .replace(/```json\s*/, "")
            .replace(/```\s*$/, "");
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText
            .replace(/```\s*/, "")
            .replace(/```\s*$/, "");
        }

        // Try to find JSON object in the text if it's embedded
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedText = jsonMatch[0];
        }

        console.log("Cleaned text for parsing:", cleanedText);
        const analysisResult = JSON.parse(cleanedText);
        console.log("Parsed analysis result:", analysisResult);
        return {
          isFarmRelated: Boolean(analysisResult.isFarmRelated),
          isSunRelated: Boolean(analysisResult.isSunRelated),
          confidence:
            typeof analysisResult.confidence === "number"
              ? analysisResult.confidence
              : 0.5,
          description:
            analysisResult.description || "Unable to generate description",
          category: analysisResult.category || "other",
          issues: Array.isArray(analysisResult.issues)
            ? analysisResult.issues
            : [],
          formData: analysisResult.formData || {
            location: null,
            currentCrops: null,
            soilType: null,
            waterSource: null,
            currentIrrigationMethod: null,
            soilMoisture: null,
            cropRotationPattern: null,
            majorChallenges: null,
            harvestSeason: null,
            fertilizerType: null,
          },
        };
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        console.error("Original text that failed to parse:", text);
        // Fallback to basic analysis
        return {
          isFarmRelated: false,
          isSunRelated: false,
          confidence: 0.1,
          description: "Failed to analyze image properly - JSON parsing error",
          category: "other",
          issues: ["AI analysis failed - JSON parsing error"],
          formData: {
            location: null,
            currentCrops: null,
            soilType: null,
            waterSource: null,
            currentIrrigationMethod: null,
            soilMoisture: null,
            cropRotationPattern: null,
            majorChallenges: null,
            harvestSeason: null,
            fertilizerType: null,
          },
        };
      }
    } catch (error) {
      console.error("Vision AI analysis failed:", error);
      console.error("Error details:", error.message);
      return {
        isFarmRelated: false,
        isSunRelated: false,
        confidence: 0,
        description: `Analysis failed due to technical error: ${error.message}`,
        category: "other",
        issues: [`Technical error during analysis: ${error.message}`],
        formData: {
          location: null,
          currentCrops: null,
          soilType: null,
          waterSource: null,
          currentIrrigationMethod: null,
          soilMoisture: null,
          cropRotationPattern: null,
          majorChallenges: null,
          harvestSeason: null,
          fertilizerType: null,
        },
      };
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  async generateReport(analysisResult: ImageAnalysisResult): Promise<string> {
    const prompt = `Based on the following image analysis, generate a brief report for water management:

Analysis Results:
- Farm Related: ${analysisResult.isFarmRelated}
- Sun Related: ${analysisResult.isSunRelated}
- Description: ${analysisResult.description}
- Category: ${analysisResult.category}
- Issues: ${analysisResult.issues?.join(", ") || "None"}

Generate a concise report (2-3 paragraphs) about the water management implications of this image, considering farming and sun exposure factors.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Report generation failed:", error);
      return "Unable to generate report at this time.";
    }
  }
}

export const visionAI = new VisionAI(import.meta.env.VITE_GEMINI_API_KEY || "");
