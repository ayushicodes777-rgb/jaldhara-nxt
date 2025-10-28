import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  Loader2,
  Mic,
  Calendar,
  ThermometerSun,
  Droplet,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ImageAnalysis,
  ImageAnalysisResult,
} from "@/components/ui/image-analysis";
import { visionAI } from "@/integrations/ai/vision";
import type WaterUsageChartType from "@/components/WaterUsageChart";
import type AiAdviceWidgetType from "@/components/AiAdviceWidget";
import { SupportedLanguage } from "@/App";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import axios from "axios";
import {
  initSpeechRecognition,
  isSpeechRecognitionAvailable,
} from "@/integrations/speech/speech-recognition";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ReportsProps {
  language: SupportedLanguage;
  WaterUsageChart?: React.ComponentType<
    React.ComponentProps<typeof WaterUsageChartType>
  >;
  AiAdviceWidget?: React.ComponentType<
    React.ComponentProps<typeof AiAdviceWidgetType>
  >;
}

// Define types for our form data
interface FarmData {
  cropTypes: string[];
  soilType: string;
  irrigationAmount?: string;
}

// Prediction data type
interface PredictionData {
  rainfallPrediction: string;
  waterAvailability: string;
  recommendedCrops: string[];
  notRecommendedCrops: string[];
  sustainabilityScore: number;
  potentialWaterSavings: string;
  irrigationRecommendation: string;
}

// Interface for PDFShift response
interface PDFShiftResponse {
  url: string;
  filename: string;
  size: number;
}

// Gemini API Key from environment variables
const GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  "AIzaSyC9TajWNNnnW5ovh64QYMfGffg0KxUfkh4";
const GEMINI_MODEL =
  import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash-lite";
const PDFSHIFT_API_KEY =
  import.meta.env.VITE_PDFSHIFT_API_KEY ||
  "sk_09d22ed471315d28c26eb187d6eaf63ab9ee9ca7";

// Interface for VoiceInputField props
interface VoiceInputFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  language: "en" | "hi";
  type?: string;
}

// VoiceInputField Component
const VoiceInputField: React.FC<VoiceInputFieldProps> = ({
  id,
  value,
  onChange,
  label,
  placeholder,
  language,
  type = "text",
}) => {
  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    if (!isSpeechRecognitionAvailable()) {
      toast.error(
        language === "en"
          ? "Voice input is not supported in your browser."
          : "आपके ब्राउज़र में वॉयस इनपुट समर्थित नहीं है।",
      );
      return;
    }

    setIsListening(true);

    const speechRecognition = initSpeechRecognition(
      language,
      (result) => {
        if (result.text) {
          onChange(result.text);
          setIsListening(false);
        }
      },
      (error) => {
        toast.error(
          language === "en"
            ? `Voice recognition error: ${error}`
            : `वॉयस पहचान त्रुटि: ${error}`,
        );
        setIsListening(false);
      },
    );

    speechRecognition.start();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-r-none focus-visible:ring-water"
          type={type}
        />
        <Button
          type="button"
          onClick={handleVoiceInput}
          className={`rounded-l-none bg-water hover:bg-water-dark text-white ${isListening ? "animate-pulse border-2 border-water" : ""}`}
          disabled={isListening}
        >
          {isListening ? (
            <div className="relative">
              <Mic className="h-4 w-4 animate-pulse" />
              <span className="absolute w-full h-full top-0 left-0 flex justify-center items-center">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-white opacity-75"></span>
              </span>
            </div>
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

const Reports: React.FC<ReportsProps> = ({
  language,
  WaterUsageChart: CustomWaterUsageChart,
  AiAdviceWidget: CustomAiAdviceWidget,
}) => {
  // Import the default components if not provided as props
  const [DefaultWaterUsageChart, setDefaultWaterUsageChart] =
    useState<any>(null);
  const [DefaultAiAdviceWidget, setDefaultAiAdviceWidget] = useState<any>(null);

  useEffect(() => {
    // Dynamically import default components if not provided
    if (!CustomWaterUsageChart) {
      import("@/components/WaterUsageChart").then((module) => {
        setDefaultWaterUsageChart(() => module.default);
      });
    }
    if (!CustomAiAdviceWidget) {
      import("@/components/AiAdviceWidget").then((module) => {
        setDefaultAiAdviceWidget(() => module.default);
      });
    }
  }, [CustomWaterUsageChart, CustomAiAdviceWidget]);

  // Use either the custom component or the default one
  const FinalWaterUsageChart = CustomWaterUsageChart || DefaultWaterUsageChart;
  const FinalAiAdviceWidget = CustomAiAdviceWidget || DefaultAiAdviceWidget;

  // Normalize language for components that only support English and Hindi
  const normalizedLanguage: "en" | "hi" = language === "hi" ? "hi" : "en";

  // State for form and generated data
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [farmData, setFarmData] = useState<FarmData>({
    cropTypes: [],
    soilType: "",
    irrigationAmount: "",
  });

  // State for AI-generated predictions
  const [predictions, setPredictions] = useState<PredictionData>({
    rainfallPrediction:
      normalizedLanguage === "en"
        ? "Below average (750mm expected)"
        : "औसत से कम (750 मिमी अपेक्षित)",
    waterAvailability:
      normalizedLanguage === "en"
        ? "Moderate decline in groundwater levels expected"
        : "भूजल स्तर में मध्यम गिरावट की उम्मीद है",
    recommendedCrops:
      normalizedLanguage === "en"
        ? ["Sorghum", "Millet", "Pulses", "Drought-resistant Rice"]
        : ["ज्वार", "बाजरा", "दालें", "सूखा-प्रतिरोधी चावल"],
    notRecommendedCrops:
      normalizedLanguage === "en"
        ? ["Traditional Rice", "Sugarcane", "Cotton"]
        : ["पारंपरिक चावल", "गन्ना", "कपास"],
    sustainabilityScore: 68,
    potentialWaterSavings: "42%",
    irrigationRecommendation:
      normalizedLanguage === "en"
        ? "Drip irrigation system with soil moisture sensors"
        : "मिट्टी की नमी संवेदकों के साथ ड्रिप सिंचाई प्रणाली",
  });

  // State for image upload and analysis
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageAnalyses, setImageAnalyses] = useState<ImageAnalysisResult[]>([]);
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false);

  // Crop water usage database (liters per hectare per season)
  const cropWaterDatabase: Record<
    string,
    { current: number; recommended: number; hiName: string; enName: string }
  > = {
    // Rice crops
    rice: {
      current: 25000,
      recommended: 18000,
      hiName: "चावल",
      enName: "Rice",
    },
    basmati: {
      current: 22000,
      recommended: 16000,
      hiName: "बासमती चावल",
      enName: "Basmati Rice",
    },

    // Wheat crops
    wheat: {
      current: 4500,
      recommended: 3200,
      hiName: "गेहूं",
      enName: "Wheat",
    },
    durum: {
      current: 4800,
      recommended: 3400,
      hiName: "दुरम गेहूं",
      enName: "Durum Wheat",
    },

    // Millets (water-efficient)
    bajra: {
      current: 3500,
      recommended: 2800,
      hiName: "बाजरा",
      enName: "Pearl Millet",
    },
    jowar: {
      current: 3800,
      recommended: 3000,
      hiName: "ज्वार",
      enName: "Sorghum",
    },
    ragi: {
      current: 3200,
      recommended: 2600,
      hiName: "रागी",
      enName: "Finger Millet",
    },

    // Pulses (water-efficient)
    chickpea: {
      current: 2800,
      recommended: 2200,
      hiName: "चना",
      enName: "Chickpea",
    },
    pigeonpea: {
      current: 3200,
      recommended: 2500,
      hiName: "अरहर",
      enName: "Pigeon Pea",
    },
    lentil: {
      current: 2600,
      recommended: 2000,
      hiName: "मसूर",
      enName: "Lentil",
    },
    greengram: {
      current: 2400,
      recommended: 1900,
      hiName: "मूंग",
      enName: "Green Gram",
    },
    blackgram: {
      current: 2500,
      recommended: 1950,
      hiName: "उड़द",
      enName: "Black Gram",
    },

    // Oilseeds
    mustard: {
      current: 3000,
      recommended: 2300,
      hiName: "सरसों",
      enName: "Mustard",
    },
    groundnut: {
      current: 4200,
      recommended: 3200,
      hiName: "मूंगफली",
      enName: "Groundnut",
    },
    soybean: {
      current: 3800,
      recommended: 2900,
      hiName: "सोयाबीन",
      enName: "Soybean",
    },
    sesame: {
      current: 2900,
      recommended: 2200,
      hiName: "तिल",
      enName: "Sesame",
    },

    // Vegetables
    tomato: {
      current: 5500,
      recommended: 4000,
      hiName: "टमाटर",
      enName: "Tomato",
    },
    potato: {
      current: 4800,
      recommended: 3600,
      hiName: "आलू",
      enName: "Potato",
    },
    onion: {
      current: 4200,
      recommended: 3200,
      hiName: "प्याज",
      enName: "Onion",
    },
    brinjal: {
      current: 4600,
      recommended: 3500,
      hiName: "बैंगन",
      enName: "Brinjal",
    },
    cauliflower: {
      current: 5100,
      recommended: 3800,
      hiName: "फूलगोभी",
      enName: "Cauliflower",
    },
    cabbage: {
      current: 4500,
      recommended: 3400,
      hiName: "पत्ता गोभी",
      enName: "Cabbage",
    },
    ladyfinger: {
      current: 4800,
      recommended: 3600,
      hiName: "भिंडी",
      enName: "Ladyfinger",
    },

    // Fruits
    mango: { current: 8500, recommended: 6200, hiName: "आम", enName: "Mango" },
    banana: {
      current: 9200,
      recommended: 6800,
      hiName: "केला",
      enName: "Banana",
    },
    guava: {
      current: 7200,
      recommended: 5400,
      hiName: "अमरूद",
      enName: "Guava",
    },
    papaya: {
      current: 6800,
      recommended: 5000,
      hiName: "पपीता",
      enName: "Papaya",
    },

    // Sugarcane (high water usage)
    sugarcane: {
      current: 45000,
      recommended: 35000,
      hiName: "गन्ना",
      enName: "Sugarcane",
    },

    // Cotton
    cotton: {
      current: 8500,
      recommended: 6200,
      hiName: "कपास",
      enName: "Cotton",
    },

    // Spices
    chili: {
      current: 5200,
      recommended: 3900,
      hiName: "मिर्च",
      enName: "Chili",
    },
    turmeric: {
      current: 6800,
      recommended: 5100,
      hiName: "हल्दी",
      enName: "Turmeric",
    },
    ginger: {
      current: 7200,
      recommended: 5400,
      hiName: "अदरक",
      enName: "Ginger",
    },

    // Others
    maize: {
      current: 4200,
      recommended: 3200,
      hiName: "मक्का",
      enName: "Maize",
    },
    barley: {
      current: 3200,
      recommended: 2500,
      hiName: "जौ",
      enName: "Barley",
    },
  };

  // Function to find crop data (case-insensitive search)
  const findCropData = (cropName: string) => {
    const lowerCropName = cropName.toLowerCase().trim();

    // Direct match
    if (cropWaterDatabase[lowerCropName]) {
      return cropWaterDatabase[lowerCropName];
    }

    // Partial match for longer names
    for (const [key, data] of Object.entries(cropWaterDatabase)) {
      if (lowerCropName.includes(key) || key.includes(lowerCropName)) {
        return data;
      }
    }

    // Try common variations
    const variations: Record<string, string> = {
      rice: "rice",
      paddy: "rice",
      dhaan: "rice",
      wheat: "wheat",
      gehun: "wheat",
      kanak: "wheat",
      millet: "bajra",
      pulse: "chickpea",
      dal: "chickpea",
      vegetable: "tomato",
      phal: "mango",
      fal: "mango",
      sugar: "sugarcane",
      ganna: "sugarcane",
      kapas: "cotton",
      mirch: "chili",
      haldi: "turmeric",
      makai: "maize",
      corn: "maize",
    };

    for (const [variant, cropKey] of Object.entries(variations)) {
      if (lowerCropName.includes(variant)) {
        return cropWaterDatabase[cropKey];
      }
    }

    // Default fallback
    return {
      current: 4000,
      recommended: 3000,
      hiName: cropName,
      enName: cropName,
    };
  };

  // Generate dynamic water usage data based on user's crops
  const [waterData, setWaterData] = useState<any[]>([]);

  // Update water data when crops change
  useEffect(() => {
    if (farmData.cropTypes.length > 0) {
      const cropData = farmData.cropTypes.map((crop) => {
        const cropInfo = findCropData(crop);
        return {
          name: normalizedLanguage === "hi" ? cropInfo.hiName : cropInfo.enName,
          current: cropInfo.current,
          recommended: cropInfo.recommended,
        };
      });

      // Add total row
      const totalCurrent = cropData.reduce(
        (sum, crop) => sum + crop.current,
        0,
      );
      const totalRecommended = cropData.reduce(
        (sum, crop) => sum + crop.recommended,
        0,
      );

      const finalData = [
        ...cropData,
        {
          name: normalizedLanguage === "hi" ? "कुल" : "Total",
          current: totalCurrent,
          recommended: totalRecommended,
        },
      ];

      setWaterData(finalData);
    }
  }, [farmData.cropTypes, normalizedLanguage]);

  // State for PDF generation
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [geminiResponse, setGeminiResponse] = useState<string>("");
  const reportRef = useRef<HTMLDivElement>(null);

  // Function to query Gemini for real crop recommendations
  const queryGemini = async (
    queryData: FarmData,
  ): Promise<PredictionData | null> => {
    try {
      // Construct the prompt for Gemini
      const prompt = `
        As an agricultural expert, provide sustainable farming recommendations for a farm with the following details:

        Current Crops: ${queryData.cropTypes.join(", ")}
        Soil Type: ${queryData.soilType}

        Based on this information and considering water sustainability, provide the following:
        1. Rainfall prediction for this region (including estimated amount in mm)
        2. Water availability outlook
        3. List of recommended crops that are water-efficient for this farm (exactly 5 crops)
        4. List of crops to avoid due to high water requirements (exactly 3 crops)
        5. A sustainability score (0-100) for the current farm setup
        6. Potential water savings percentage if recommendations are followed
        7. Specific irrigation recommendation for better water efficiency

        Format your response as a JSON object with the following structure:
        {
          "rainfallPrediction": "string",
          "waterAvailability": "string",
          "recommendedCrops": ["crop1", "crop2", "crop3", "crop4", "crop5"],
          "notRecommendedCrops": ["crop1", "crop2", "crop3"],
          "sustainabilityScore": number,
          "potentialWaterSavings": "string with percentage",
          "irrigationRecommendation": "string"
        }

        Explain your recommendations briefly but keep the JSON structure intact.
      `;

      console.log("Sending prompt to Gemini:", prompt);

      // Make API call to Gemini API with updated model
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        },
      );

      console.log("Received response from Gemini:", response.data);

      // Store the full text response for debugging
      if (
        response.data &&
        response.data.candidates &&
        response.data.candidates[0] &&
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts
      ) {
        const fullResponse = response.data.candidates[0].content.parts[0].text;
        setGeminiResponse(fullResponse);

        // Extract the JSON part from the response
        try {
          // Try different patterns to find JSON
          const jsonMatch =
            fullResponse.match(/```json\n([\s\S]*)\n```/) ||
            fullResponse.match(/```\n([\s\S]*)\n```/) ||
            fullResponse.match(/{[\s\S]*}/);

          if (jsonMatch) {
            let jsonStr = jsonMatch[1] || jsonMatch[0];
            // Clean up the JSON string
            jsonStr = jsonStr.replace(/```json|```/g, "").trim();

            console.log("Extracted JSON string:", jsonStr);

            // Parse the JSON
            const geminiData = JSON.parse(jsonStr);

            // Check if we have all required properties
            if (
              geminiData.rainfallPrediction &&
              geminiData.waterAvailability &&
              geminiData.recommendedCrops &&
              geminiData.notRecommendedCrops &&
              geminiData.sustainabilityScore &&
              geminiData.potentialWaterSavings &&
              geminiData.irrigationRecommendation
            ) {
              return {
                rainfallPrediction: geminiData.rainfallPrediction,
                waterAvailability: geminiData.waterAvailability,
                recommendedCrops: geminiData.recommendedCrops,
                notRecommendedCrops: geminiData.notRecommendedCrops,
                sustainabilityScore: geminiData.sustainabilityScore,
                potentialWaterSavings: geminiData.potentialWaterSavings,
                irrigationRecommendation: geminiData.irrigationRecommendation,
              };
            } else {
              console.error("Missing required properties in Gemini response");
              throw new Error("Invalid response format from Gemini API");
            }
          } else {
            console.error("No JSON found in Gemini response");

            // Try to parse the entire response as JSON
            try {
              const geminiData = JSON.parse(fullResponse);
              if (geminiData.rainfallPrediction) {
                return geminiData;
              } else {
                throw new Error("Invalid JSON format");
              }
            } catch (e) {
              console.error("Failed to parse Gemini response as JSON:", e);
              throw new Error("Invalid response format from Gemini API");
            }
          }
        } catch (e) {
          console.error("Error parsing Gemini response:", e);
          throw new Error("Error parsing Gemini response");
        }
      } else {
        console.error("Unexpected Gemini response structure:", response.data);
        throw new Error("Unexpected response structure from Gemini API");
      }
    } catch (error) {
      console.error("Error querying Gemini:", error);
      return null;
    }
  };

  // Generate data based on location and farm inputs
  const generatePredictions = async () => {
    setIsGenerating(true);

    try {
      // Get real recommendations from Gemini
      let geminiPredictions: PredictionData | null = null;

      try {
        geminiPredictions = await queryGemini(farmData);
      } catch (geminiError) {
        console.error("Error with Gemini API:", geminiError);
        toast.error(
          normalizedLanguage === "en"
            ? "Could not connect to Gemini API. Using default data."
            : "जेमिनी API से कनेक्ट नहीं कर सके। डिफ़ॉल्ट डेटा का उपयोग कर रहे हैं।",
        );
      }

      if (geminiPredictions) {
        // Update with real data from Gemini
        setPredictions(geminiPredictions);
        setHasGeneratedReport(true);

        toast.success(
          normalizedLanguage === "en"
            ? "Report generated successfully with FarmGPT AI!"
            : "FarmGPT AI के साथ रिपोर्ट सफलतापूर्वक जनरेट की गई!",
        );
      } else {
        // Fallback to mock data if Gemini fails
        console.log("Using fallback data");

        // Generate region-appropriate predictions based on location
        let regionBasedRecommendations = {
          recommendedCrops: [
            "Sorghum",
            "Millet",
            "Pulses",
            "Drought-resistant Rice",
            "Barley",
          ],
          notRecommendedCrops: ["Traditional Rice", "Sugarcane", "Cotton"],
          rainfallPrediction: `750-850mm expected annually`,
          waterAvailability: "Moderate decline in groundwater levels expected",
        };

        // Use general recommendations since we don't have location data
        regionBasedRecommendations.rainfallPrediction =
          "750-850mm expected annually";

        // Convert region names to Hindi if needed
        if (normalizedLanguage === "hi") {
          regionBasedRecommendations.recommendedCrops =
            regionBasedRecommendations.recommendedCrops.map((crop) => {
              const cropTranslations: Record<string, string> = {
                Wheat: "गेहूं",
                Maize: "मक्का",
                Pulses: "दालें",
                Oilseeds: "तिलहन",
                Barley: "जौ",
                "Pearl Millet": "बाजरा",
                Sorghum: "ज्वार",
                "Cluster Bean": "ग्वार",
                "Moth Bean": "मोठ",
                Sesame: "तिल",
                Coconut: "नारियल",
                Arecanut: "सुपारी",
                "Black Pepper": "काली मिर्च",
                Cardamom: "इलायची",
                Coffee: "कॉफी",
                Chickpea: "चना",
                Mustard: "सरसों",
                Lentil: "मसूर",
                "Drought-resistant Rice": "सूखा-प्रतिरोधी चावल",
              };
              return cropTranslations[crop] || crop;
            });

          regionBasedRecommendations.notRecommendedCrops =
            regionBasedRecommendations.notRecommendedCrops.map((crop) => {
              const cropTranslations: Record<string, string> = {
                "Traditional Rice": "पारंपरिक चावल",
                Sugarcane: "गन्ना",
                Cotton: "कपास",
              };
              return cropTranslations[crop] || crop;
            });
        }

        const fallbackPredictions: PredictionData = {
          rainfallPrediction:
            normalizedLanguage === "en"
              ? regionBasedRecommendations.rainfallPrediction
              : regionBasedRecommendations.rainfallPrediction.replace(
                  "expected annually",
                  "वार्षिक अपेक्षित",
                ),
          waterAvailability:
            normalizedLanguage === "en"
              ? regionBasedRecommendations.waterAvailability
              : "भूजल स्तर में मध्यम गिरावट की उम्मीद है",
          recommendedCrops: regionBasedRecommendations.recommendedCrops,
          notRecommendedCrops: regionBasedRecommendations.notRecommendedCrops,
          sustainabilityScore: 55 + Math.floor(Math.random() * 30),
          potentialWaterSavings: `${35 + Math.floor(Math.random() * 15)}%`,
          irrigationRecommendation:
            normalizedLanguage === "en"
              ? "Drip irrigation system with soil moisture sensors"
              : "मिट्टी की नमी संवेदकों के साथ ड्रिप सिंचाई प्रणाली",
        };

        setPredictions(fallbackPredictions);

        // Update water usage data
        const farmSizeNum = parseInt(farmData.farmSize) || 5;
        const baseRiceUsage = 800 * farmSizeNum;
        const baseWheatUsage = 400 * farmSizeNum;

        const savingsPercent =
          parseInt(fallbackPredictions.potentialWaterSavings) || 35;
        const savingsFactor = (100 - savingsPercent) / 100;

        const newWaterData = [
          {
            name: normalizedLanguage === "en" ? "Rice" : "चावल",
            current: baseRiceUsage,
            recommended: Math.floor(baseRiceUsage * savingsFactor),
          },
          {
            name: normalizedLanguage === "en" ? "Wheat" : "गेहूं",
            current: baseWheatUsage,
            recommended: Math.floor(baseWheatUsage * savingsFactor),
          },
          {
            name: normalizedLanguage === "en" ? "Total" : "कुल",
            current: baseRiceUsage + baseWheatUsage,
            recommended:
              Math.floor(baseRiceUsage * savingsFactor) +
              Math.floor(baseWheatUsage * savingsFactor),
          },
        ];

        setWaterData(newWaterData);
        setHasGeneratedReport(true);

        toast.info(
          normalizedLanguage === "en"
            ? "Using fallback data for recommendations"
            : "सिफारिशों के लिए फॉलबैक डेटा का उपयोग किया जा रहा है",
        );
      }
    } catch (error) {
      console.error("Error in report generation:", error);
      toast.error(
        normalizedLanguage === "en"
          ? "Error generating report. Please try again."
          : "रिपोर्ट जनरेट करने में त्रुटि। कृपया पुन: प्रयास करें।",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate PDF using html2canvas and jsPDF
  const generatePDF = async () => {
    setIsLoading(true);

    try {
      // Validate required fields before generating PDF
      if (!farmData.cropTypes.length || !farmData.soilType) {
        toast.error(
          normalizedLanguage === "en"
            ? "Please fill in crop types and soil type before generating PDF."
            : "PDF जनरेट करने से पहले कृपया फसलें और मिट्टी का प्रकार भरें।",
        );
        setIsLoading(false);
        return;
      }

      if (reportRef.current) {
        toast.info(
          normalizedLanguage === "en"
            ? "Capturing report and generating PDF..."
            : "रिपोर्ट कैप्चर कर रहे हैं और PDF जनरेट कर रहे हैं...",
        );

        // Use html2canvas to capture the report element
        const canvas = await html2canvas(reportRef.current, {
          scale: 2, // Higher quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          width: reportRef.current.scrollWidth,
          height: reportRef.current.scrollHeight,
        });

        // Create PDF
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");

        // Calculate dimensions
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        // Scale image to fit PDF width
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 0;

        // Add image to PDF
        pdf.addImage(
          imgData,
          "PNG",
          imgX,
          imgY,
          imgWidth * ratio,
          imgHeight * ratio,
        );

        // Generate filename
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `FarmGPT_Report_${timestamp}.pdf`;

        // Save the PDF
        pdf.save(filename);

        // Store in localStorage for the Reports section
        const storedReports = JSON.parse(
          localStorage.getItem("jaldhara_reports") || "[]",
        );
        const newReport = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          filename: filename,
          crops: farmData.cropTypes.join(", "),
          data: null, // No URL needed since we download directly
          sustainabilityScore: predictions.sustainabilityScore,
        };
        storedReports.push(newReport);
        localStorage.setItem("jaldhara_reports", JSON.stringify(storedReports));

        toast.success(
          normalizedLanguage === "en"
            ? "PDF Report generated and downloaded successfully!"
            : "PDF रिपोर्ट सफलतापूर्वक जनरेट और डाउनलोड की गई!",
        );
      }
    } catch (error) {
      console.error("Error in PDF generation process:", error);
      toast.error(
        normalizedLanguage === "en"
          ? "Error generating PDF. Please try again."
          : "PDF जनरेट करने में त्रुटि। कृपया पुन: प्रयास करें।",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const content = {
    en: {
      title: "Farm Water Assessment Report",
      subtitle: "Generate a personalized sustainability report for your farm",
      formTitle: "Farm Details",
      cropTypes: "Current Crops",
      soilType: "Soil Type",
      generateButton: "Generate Report",
      generatingText: "Analyzing data...",
      noReports:
        "Complete the form to generate your personalized water assessment report.",
      reportTitle: "Water Sustainability Assessment",
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      summary:
        "Based on your input and our AI analysis, we've assessed your current water usage patterns and identified potential water-saving opportunities for sustainable farming.",
      farmDetails: "Farm Details",
      climate: "Climate Predictions",
      recommendations: "Crop Recommendations",
      sustainabilityScore: "Sustainability Score",
      irrigation: "Irrigation Recommendations",
      download: "Download PDF Report",
      print: "Print Report",
      share: "Share Report",
      recommended: "Recommended Crops",
      notRecommended: "Not Recommended Crops",
      soilMoisture: "Soil Moisture",
      cropRotationPattern: "Crop Rotation Pattern",
      majorChallenges: "Major Challenges",
      harvestSeason: "Harvest Season",
      fertilizerUsage: "Fertilizer Type",
      organicFarming: "Practicing Organic Farming",
    },
    hi: {
      title: "खेत जल मूल्यांकन रिपोर्ट",
      subtitle: "अपने खेत के लिए व्यक्तिगत स्थिरता रिपोर्ट जनरेट करें",
      formTitle: "खेत विवरण",
      cropTypes: "वर्तमान फसलें",
      soilType: "मिट्टी का प्रकार",
      generateButton: "रिपोर्ट जनरेट करें",
      generatingText: "डेटा का विश्लेषण...",
      noReports:
        "अपनी व्यक्तिगत जल मूल्यांकन रिपोर्ट जनरेट करने के लिए फॉर्म भरें।",
      reportTitle: "जल स्थिरता मूल्यांकन",
      date: new Date().toLocaleDateString("hi-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      summary:
        "आपके इनपुट और हमारे AI विश्लेषण के आधार पर, हमने आपके वर्तमान जल उपयोग पैटर्न का आकलन किया है और टिकाऊ खेती के लिए संभावित जल-बचत के अवसरों की पहचान की है।",
      farmDetails: "खेत विवरण",
      climate: "जलवायु पूर्वानुमान",
      recommendations: "फसल अनुशंसाएँ",
      sustainabilityScore: "स्थिरता स्कोर",
      irrigation: "सिंचाई संबंधी सिफारिशें",
      download: "PDF रिपोर्ट डाउनलोड करें",
      print: "रिपोर्ट प्रिंट करें",
      share: "रिपोर्ट शेयर करें",
      recommended: "अनुशंसित फसलें",
      notRecommended: "अनुशंसित नहीं फसलें",
      soilMoisture: "मिट्टी की नमी",
      cropRotationPattern: "फसल चक्र पैटर्न",
      majorChallenges: "प्रमुख चुनौतियाँ",
      harvestSeason: "फसल का मौसम",
      fertilizerUsage: "उर्वरक प्रकार",
      organicFarming: "जैविक खेती का अभ्यास",
    },
  };

  // Modified handleAction to use new PDF generation
  const handleAction = (action: string) => {
    if (action === "download") {
      generatePDF();
      return;
    }

    const messages = {
      en: {
        print: "Sending report to printer...",
        share: "Report sharing options opened",
      },
      hi: {
        print: "रिपोर्ट प्रिंटर को भेज रहे हैं...",
        share: "रिपोर्ट साझाकरण विकल्प खोले गए",
      },
    };

    toast.success(
      messages[normalizedLanguage][action as keyof typeof messages.en],
    );
  };

  // Image handling functions
  const handleImagesSelect = (files: File[], previews: string[]) => {
    setSelectedImages((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...previews]);
    setImageAnalyses([]); // Reset previous analyses
    // No automatic analysis - user needs to click "Start Analysis" button
  };

  const handleImageRemove = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setImageAnalyses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageClear = () => {
    setSelectedImages([]);
    setImagePreviews([]);
    setImageAnalyses([]);
  };

  const handleStartAnalysis = async () => {
    if (selectedImages.length === 0) {
      toast.error(
        normalizedLanguage === "en"
          ? "Please upload at least one image first."
          : "कृपया कम से एक छवि अपलोड करें।",
      );
      return;
    }

    setIsAnalyzingImages(true);
    try {
      console.log("Starting analysis for", selectedImages.length, "images");
      const analysisPromises = selectedImages.map((file) =>
        visionAI.analyzeImage(file),
      );
      const results = await Promise.all(analysisPromises);
      console.log("Analysis results received:", results);

      setImageAnalyses(results);

      // Auto-populate form fields with aggregated high-confidence data
      const aggregatedUpdates = aggregateFormDataFromAnalyses(results);
      console.log("Aggregated updates:", aggregatedUpdates);
      if (aggregatedUpdates && Object.keys(aggregatedUpdates).length > 0) {
        // Clear default template values for fields not filled by AI
        const updatedFarmData = { ...farmData };
        const defaultValues = {
          cropTypes: [],
          soilType: "",
          irrigationAmount: "",
        };

        // Only clear fields that weren't filled by AI and have default values
        const fieldsToClear: (keyof FarmData)[] = [];
        if (
          !aggregatedUpdates.cropTypes &&
          JSON.stringify(updatedFarmData.cropTypes) ===
            JSON.stringify(defaultValues.cropTypes)
        ) {
          delete updatedFarmData.cropTypes;
          fieldsToClear.push("cropTypes");
        }
        if (
          !aggregatedUpdates.soilType &&
          updatedFarmData.soilType === defaultValues.soilType
        ) {
          delete updatedFarmData.soilType;
          fieldsToClear.push("soilType");
        }
        if (
          !aggregatedUpdates.irrigationAmount &&
          updatedFarmData.irrigationAmount === defaultValues.irrigationAmount
        ) {
          delete updatedFarmData.irrigationAmount;
          fieldsToClear.push("irrigationAmount");
        }

        // Apply AI updates
        const finalFarmData = { ...updatedFarmData, ...aggregatedUpdates };
        setFarmData(finalFarmData);

        const fieldsUpdated = Object.keys(aggregatedUpdates).length;
        const fieldsCleared = fieldsToClear.length;

        toast.success(
          normalizedLanguage === "en"
            ? `✅ Auto-filled ${fieldsUpdated} field${fieldsUpdated > 1 ? "s" : ""} from ${selectedImages.length} image${selectedImages.length > 1 ? "s" : ""}${fieldsCleared > 0 ? ` (cleared ${fieldsCleared} default field${fieldsCleared > 1 ? "s" : ""})` : ""}`
            : `✅ छवि विश्लेषण से ${fieldsUpdated} फ़ील्ड${fieldsUpdated > 1 ? "" : "s"} भरे गए${fieldsCleared > 0 ? ` (${fieldsCleared} डिफ़ॉल्ट फ़ील्ड${fieldsCleared > 1 ? "s" : ""} हटाए)` : ""}`,
        );
      } else {
        toast.info(
          normalizedLanguage === "en"
            ? "ℹ️ Analysis complete, but no confident data extracted to fill form fields."
            : "ℹ️ विश्लेषण पूरी, लेकिन कोई आत्मवर्त डेटा फ़ील्ड करने के लिए निकाला गया।",
        );
      }
    } catch (error) {
      console.error("Image analysis failed:", error);
      toast.error(
        normalizedLanguage === "en"
          ? "Failed to analyze images. Please try again."
          : "छवि विश्लेषण में विफल। कृपया फिर से कोशिश करें।",
      );
    } finally {
      setIsAnalyzingImages(false);
    }
  };

  const aggregateFormDataFromAnalyses = (
    analyses: ImageAnalysisResult[],
  ): Partial<FarmData> => {
    const updates: Partial<FarmData> = {};
    let fieldsUpdated = 0;

    const highConfidenceAnalyses = analyses.filter((a) => a.confidence >= 0.7);

    if (highConfidenceAnalyses.length === 0) return {};

    // Aggregate data from high confidence analyses
    for (const analysis of highConfidenceAnalyses) {
      if (analysis.formData) {
        if (
          analysis.formData.currentCrops &&
          analysis.formData.currentCrops.length > 0 &&
          !updates.cropTypes
        ) {
          updates.cropTypes = analysis.formData.currentCrops;
        }
        if (analysis.formData.soilType && !updates.soilType) {
          updates.soilType = analysis.formData.soilType;
        }
      }
    }

    return updates;
  };

  // Use English content as fallback for languages other than Hindi
  const activeContent = content[normalizedLanguage];

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">{activeContent.title}</h1>
      <p className="text-muted-foreground mb-6">{activeContent.subtitle}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{activeContent.formTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <VoiceInputField
                id="crops"
                value={farmData.cropTypes.join(", ")}
                onChange={(value) =>
                  setFarmData({ ...farmData, cropTypes: value.split(", ") })
                }
                label={activeContent.cropTypes}
                language={normalizedLanguage}
              />

              <div className="space-y-2">
                <Label htmlFor="soilType">{activeContent.soilType}</Label>
                <div className="flex">
                  <Select
                    onValueChange={(value) =>
                      setFarmData({ ...farmData, soilType: value })
                    }
                    defaultValue={farmData.soilType}
                  >
                    <SelectTrigger className="flex-1 rounded-r-none">
                      <SelectValue placeholder={farmData.soilType} />
                    </SelectTrigger>
                    <SelectContent>
                      {normalizedLanguage === "en" ? (
                        <>
                          <SelectItem value="Black clay soil">
                            Black clay soil
                          </SelectItem>
                          <SelectItem value="Red loamy soil">
                            Red loamy soil
                          </SelectItem>
                          <SelectItem value="Sandy soil">Sandy soil</SelectItem>
                          <SelectItem value="Alluvial soil">
                            Alluvial soil
                          </SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="काली मिट्टी">
                            काली मिट्टी
                          </SelectItem>
                          <SelectItem value="लाल दोमट मिट्टी">
                            लाल दोमट मिट्टी
                          </SelectItem>
                          <SelectItem value="रेतीली मिट्टी">
                            रेतीली मिट्टी
                          </SelectItem>
                          <SelectItem value="जलोढ़ मिट्टी">
                            जलोढ़ मिट्टी
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={() => {
                      toast.info(
                        normalizedLanguage === "en"
                          ? "Please select soil type from the list"
                          : "कृपया सूची से मिट्टी का प्रकार चुनें",
                      );
                    }}
                    className="rounded-l-none bg-water hover:bg-water-dark text-white"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <VoiceInputField
                id="irrigationAmount"
                value={farmData.irrigationAmount || ""}
                onChange={(value) =>
                  setFarmData({
                    ...farmData,
                    irrigationAmount: value,
                  })
                }
                label={
                  normalizedLanguage === "en"
                    ? "Daily Irrigation Amount (in liters)"
                    : "दैनिक सिंचाई की मात्रा (लीटर में)"
                }
                type="number"
                language={normalizedLanguage}
              />

              <Separator className="my-4" />

              <div className="space-y-4">
                <Label className="text-base font-medium">
                  {normalizedLanguage === "en"
                    ? "📸 Image Analysis"
                    : "📸 छवि विश्लेषण"}
                </Label>

                <ImageUpload
                  onImagesSelect={handleImagesSelect}
                  onImageRemove={handleImageRemove}
                  onImageClear={handleImageClear}
                  onStartAnalysis={handleStartAnalysis}
                  previews={imagePreviews}
                />

                <ImageAnalysis
                  analyses={imageAnalyses}
                  isAnalyzing={isAnalyzingImages}
                />
              </div>

              <Button
                className="w-full mt-4 gap-2 bg-water hover:bg-water-dark text-white"
                onClick={generatePredictions}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {activeContent.generatingText}
                  </>
                ) : (
                  activeContent.generateButton
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Debug section - only in development */}
          {process.env.NODE_ENV === "development" && geminiResponse && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">
                  Gemini Raw Response (Debug)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                  {geminiResponse}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-2">
          {!hasGeneratedReport ? (
            <Card className="h-full flex items-center justify-center p-6">
              <p className="text-center text-muted-foreground">
                {activeContent.noReports}
              </p>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{activeContent.reportTitle}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {activeContent.date}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6" ref={reportRef}>
                <p>{activeContent.summary}</p>

                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    {activeContent.farmDetails}
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="border rounded p-3">
                      <p className="text-sm text-muted-foreground">
                        {activeContent.cropTypes}
                      </p>
                      <p className="font-medium">
                        {farmData.cropTypes.join(", ")}
                      </p>
                    </div>
                    <div className="border rounded p-3">
                      <p className="text-sm text-muted-foreground">
                        {activeContent.soilType}
                      </p>
                      <p className="font-medium">{farmData.soilType}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    {activeContent.climate}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded p-4 bg-blue-50">
                      <p className="text-sm text-blue-800 mb-1">
                        {normalizedLanguage === "en"
                          ? "Rainfall Prediction"
                          : "वर्षा का पूर्वानुमान"}
                      </p>
                      <p className="font-medium">
                        {predictions.rainfallPrediction}
                      </p>
                    </div>
                    <div className="border rounded p-4 bg-blue-50">
                      <p className="text-sm text-blue-800 mb-1">
                        {normalizedLanguage === "en"
                          ? "Water Availability"
                          : "जल उपलब्धता"}
                      </p>
                      <p className="font-medium">
                        {predictions.waterAvailability}
                      </p>
                    </div>
                  </div>
                </div>

                {FinalWaterUsageChart && (
                  <FinalWaterUsageChart
                    data={waterData}
                    language={normalizedLanguage}
                  />
                )}

                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    {activeContent.recommendations}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded p-4 bg-green-50">
                      <p className="text-sm text-green-800 mb-2">
                        {activeContent.recommended}
                      </p>
                      <div className="space-y-1">
                        {predictions.recommendedCrops.map((crop, idx) => (
                          <div key={idx} className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <p>{crop}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border rounded p-4 bg-red-50">
                      <p className="text-sm text-red-800 mb-2">
                        {activeContent.notRecommended}
                      </p>
                      <div className="space-y-1">
                        {predictions.notRecommendedCrops.map((crop, idx) => (
                          <div key={idx} className="flex items-center">
                            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                            <p>{crop}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-water/10 p-4 rounded-lg">
                    <h3 className="font-semibold text-water-dark mb-1">
                      {activeContent.sustainabilityScore}
                    </h3>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2 mb-1">
                      <div
                        className={`h-2.5 rounded-full ${
                          predictions.sustainabilityScore > 80
                            ? "bg-green-500"
                            : predictions.sustainabilityScore > 60
                              ? "bg-yellow-500"
                              : "bg-orange-500"
                        }`}
                        style={{ width: `${predictions.sustainabilityScore}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                    <p className="mt-2">
                      {normalizedLanguage === "en"
                        ? `Your farm's water sustainability score is ${predictions.sustainabilityScore}/100`
                        : `आपके खेत का जल स्थिरता स्कोर ${predictions.sustainabilityScore}/100 है`}
                    </p>
                  </div>

                  <div className="bg-earth/10 p-4 rounded-lg">
                    <h3 className="font-semibold text-earth-dark mb-2">
                      {activeContent.irrigation}
                    </h3>
                    <p className="mb-2">
                      {predictions.irrigationRecommendation}
                    </p>
                    <p className="font-medium">
                      {normalizedLanguage === "en"
                        ? `Potential water savings: ${predictions.potentialWaterSavings}`
                        : `संभावित जल बचत: ${predictions.potentialWaterSavings}`}
                    </p>
                  </div>
                </div>

                <div className="text-center text-xs text-gray-500 mt-4">
                  {normalizedLanguage === "en"
                    ? "Analysis powered by FarmGPT"
                    : "FarmGPT द्वारा संचालित विश्लेषण"}
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-3 border-t pt-6">
                <Button
                  variant="outline"
                  className="gap-2 app-button-glow water-button-glow"
                  onClick={() => handleAction("download")}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {activeContent.download}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
