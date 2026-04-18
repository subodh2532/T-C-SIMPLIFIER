import type { OutputLanguage } from "@/lib/types";

export const languages: {
  label: OutputLanguage;
  speechCode: string;
  helper: string;
}[] = [
  {
    label: "English",
    speechCode: "en-US",
    helper: "Plain English output and voice."
  },
  {
    label: "Hindi",
    speechCode: "hi-IN",
    helper: "Simple Hindi bullets and Hindi voice where available."
  },
  {
    label: "Hinglish",
    speechCode: "hi-IN",
    helper: "Hindi-English mix with Hindi voice."
  },
  {
    label: "Marathi",
    speechCode: "mr-IN",
    helper: "Simple Marathi bullets and Marathi voice where available."
  }
];
