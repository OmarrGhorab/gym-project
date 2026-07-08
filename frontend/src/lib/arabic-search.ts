const ARABIC_SEARCH_REPLACEMENTS: Record<string, string> = {
  أ: "ا",
  إ: "ا",
  آ: "ا",
  ٱ: "ا",
  ى: "ي",
  ئ: "ي",
  ی: "ي",
  ؤ: "و",
  ة: "ه",
  ک: "ك",
  ـ: "",
  "\u064b": "",
  "\u064c": "",
  "\u064d": "",
  "\u064e": "",
  "\u064f": "",
  "\u0650": "",
  "\u0651": "",
  "\u0652": "",
};

const ARABIC_SEARCH_PATTERN = new RegExp(`[${Object.keys(ARABIC_SEARCH_REPLACEMENTS).join("")}]`, "g");

export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(ARABIC_SEARCH_PATTERN, (match) => ARABIC_SEARCH_REPLACEMENTS[match] ?? match);
}

export function includesNormalizedSearch(value: unknown, query: unknown) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  return normalizeSearchText(value).includes(normalizedQuery);
}
