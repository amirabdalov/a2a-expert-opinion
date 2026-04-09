// Shared state for AI chat → request pipeline (no localStorage due to sandbox)
let prefillData: {
  aiResponse: string;
  category: string;
  title: string;
  llmProvider: string;
  llmModel: string;
} | null = null;

export function setPrefillData(data: typeof prefillData) {
  prefillData = data;
}

export function getPrefillData() {
  return prefillData;
}

export function clearPrefillData() {
  prefillData = null;
}
