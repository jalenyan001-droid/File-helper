import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key not found");
    }
    return new GoogleGenAI({ apiKey });
};

export const enhanceText = async (fieldName: string, currentValue: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const model = 'gemini-2.5-flash';
        
        const prompt = `
        Context: A user is filling out a contract.
        Field Name: "${fieldName}"
        User Input (Draft): "${currentValue}"
        
        Task: Polish the User Input to be professional, legally sound, and formal suitable for a business contract.
        If the input is empty, generate a plausible placeholder example for this field.
        Return ONLY the polished text, no explanations.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });

        return response.text?.trim() || currentValue;
    } catch (error) {
        console.error("Gemini enhancement failed:", error);
        return currentValue; // Fallback to original
    }
};

export const suggestTableData = async (description: string): Promise<string> => {
   try {
        const ai = getAiClient();
        const model = 'gemini-2.5-flash';
        
        const prompt = `
        Generate 3 rows of sample product data for a contract based on this description: "${description}".
        Return valid JSON array. Each object should have: name, model, quantity (number), price (number), remark.
        Example: [{"name": "Laptop", "model": "X1", "quantity": 2, "price": 1000, "remark": ""}]
        Return ONLY JSON.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        return response.text || "[]";
    } catch (error) {
        console.error("Gemini table suggestion failed:", error);
        return "[]";
    } 
}
