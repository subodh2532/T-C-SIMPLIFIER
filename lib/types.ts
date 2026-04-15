export type LanguageOption = "English" | "Hindi" | "Marathi" | "Hinglish";

export type SimplifiedTerms = {
  language: LanguageOption;
  summary: string[];
  key_points: string[];
  risks: string[];
  data_usage: string[];
  safety_score: number;
};

export type FetchTermsResponse = {
  content: string;
  source: string;
};
