import type { LanguageOption } from "@/lib/types";

export const languages: {
  label: LanguageOption;
  speechCode: string;
  helper: string;
}[] = [
  {
    label: "English",
    speechCode: "en-IN",
    helper: "Plain everyday English"
  },
  {
    label: "Hindi",
    speechCode: "hi-IN",
    helper: "Simple spoken Hindi"
  },
  {
    label: "Marathi",
    speechCode: "mr-IN",
    helper: "Easy conversational Marathi"
  },
  {
    label: "Hinglish",
    speechCode: "hi-IN",
    helper: "Natural Hindi + English mix"
  }
];
