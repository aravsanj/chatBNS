export interface ChatRequestBody {
  query: string;
}

export interface ChatResponseBody {
  answer: string;
  sources: { section: string; chapter: string }[];
}
