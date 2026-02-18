
import { GoogleGenAI, Type } from "@google/genai";
import { ParseResult, SimulationResult } from "../types";

const PARSE_SYSTEM_INSTRUCTION = `
You are a computer science tutor. Your task is to extract the logical structure of a flowchart from text or an image.
Return ONLY valid JSON.
Identify all input variables and the sequence of blocks (start, input, process, decision, output, end).
Assign unique numeric IDs to each block.
`;

const SIMULATE_SYSTEM_INSTRUCTION = `
You are a computer science professor. 
Perform a granular, step-by-step dry run of the provided algorithm with the given inputs.
For EVERY line of code or logic block change, create a new step in the 'dry_run' array.
Map each dry run step to the 'flowchart_step_id' from the provided digital flowchart.
If the logic contains an error (like a wrong condition or calculation), note it in 'mistake_explanation'.
"is_correct" should be true ONLY if the algorithm correctly solves the task.
`;

export async function parseFlowchart(description: string, imageBase64?: string): Promise<ParseResult> {
  // Always create a new client right before the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const parts: any[] = [{ text: `Analyze the algorithm: "${description}". Convert it into a digital flowchart structure and identify variables.
  JSON structure: { "variables": ["v1", "v2"], "digital_flowchart": [{ "id": 1, "type": "start", "text": "Start" }, ...] }` }];
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(',')[1] || imageBase64
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: PARSE_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variables: { type: Type.ARRAY, items: { type: Type.STRING } },
            digital_flowchart: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ['start', 'process', 'decision', 'input', 'output', 'end'] },
                  text: { type: Type.STRING }
                },
                required: ["id", "type", "text"]
              }
            }
          },
          required: ["variables", "digital_flowchart"]
        }
      }
    });
    const parsed = JSON.parse(response.text || '{}');
    return {
      variables: parsed.variables || [],
      digital_flowchart: parsed.digital_flowchart || []
    };
  } catch (error) {
    console.error("Parse Error:", error);
    throw error;
  }
}

export async function runSimulation(
  description: string, 
  inputs: Record<string, string>, 
  digitalFlowchart: any[],
  imageBase64?: string
): Promise<SimulationResult> {
  // Create a new instance right before making an API call to ensure it uses the most up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const safeInputs = inputs || {};
  const inputStr = Object.entries(safeInputs).map(([k, v]) => `${k}=${v}`).join(", ");
  const parts: any[] = [
    { text: `Algorithm: ${description}. 
    Inputs: ${inputStr}. 
    Flowchart Structure: ${JSON.stringify(digitalFlowchart)}. 
    Please produce a step-by-step dry run trace. Ensure 'variable_state' is present in every step.` }
  ];

  if (imageBase64) {
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] || imageBase64 }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        systemInstruction: SIMULATE_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // Increase thinking budget to maximum for complex logic dry-runs
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });
    const result = JSON.parse(response.text.trim() || '{}');
    
    // Defensive normalization of dry_run steps
    const normalizedDryRun = (result.dry_run || []).map((step: any) => ({
      ...step,
      variable_state: step.variable_state || {}
    }));

    return {
      dry_run: normalizedDryRun,
      is_correct: !!result.is_correct,
      accuracy_score: result.accuracy_score ?? 0,
      mistake_explanation: result.mistake_explanation,
      expected_output: result.expected_output,
      actual_output: result.actual_output
    };
  } catch (error) {
    console.error("Simulation Error:", error);
    throw error;
  }
}
