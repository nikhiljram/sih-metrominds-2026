"""LLM Provider — Gemini integration with provider-agnostic interface"""

import json
from google import genai
from google.genai import types
from app.config import settings


class LLMProvider:
    """Provider-agnostic LLM interface. Currently supports Google Gemini."""

    def __init__(self):
        if settings.GEMINI_API_KEY:
            try:
                self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                print(f"[WARN] Failed to initialize Gemini LLM client: {e}")
                self.client = None
        else:
            self.client = None
        self.model = settings.LLM_MODEL

    def generate(self, prompt: str, system_prompt: str = None, temperature: float = 0.3) -> str:
        """Generate response using Gemini with fallback synthesis."""
        if not self.client:
            return self._heuristic_fallback(prompt)

        full_prompt = prompt
        if system_prompt:
            full_prompt = f"SYSTEM INSTRUCTION: {system_prompt}\n\n{prompt}"

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=full_prompt,
            )
            return response.text
        except Exception as e:
            print(f"[WARN] Gemini API call failed: {e}")
            return self._heuristic_fallback(prompt)

    def _heuristic_fallback(self, prompt: str) -> str:
        """Question-aware conversational synthesis for clean chatbot responses."""
        question = ""
        if "OFFICER'S QUESTION:" in prompt:
            q_part = prompt.split("OFFICER'S QUESTION:")[-1].strip()
            question = q_part.split("\n")[0].strip()

        stopwords = {'who', 'what', 'is', 'the', 'are', 'was', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'with', 'for', 'case'}
        keywords = [w.lower() for w in question.replace('?', '').replace(',', '').split() if w.lower() not in stopwords and len(w) > 2]

        lines = prompt.split('\n')
        extracted_facts = []

        for line in lines:
            stripped = line.strip().strip('"').strip("'")
            if not stripped or stripped.startswith('[') or stripped.startswith('---') or stripped.startswith('SYSTEM') or stripped.startswith('OFFICER') or stripped.startswith('CASE EVIDENCE'):
                continue
            if stripped.startswith('- ') or '|' in stripped or any(kw in stripped.lower() for kw in keywords) or len(stripped) > 25:
                # Clean up repeated noise lines
                if stripped not in extracted_facts and not stripped.startswith('Page ') and not stripped.startswith('Source:'):
                    extracted_facts.append(stripped)

        paragraphs = []
        if question:
            paragraphs.append(f"Here is the detailed summary regarding **\"{question}\"** based on the active case dossier:\n")
        else:
            paragraphs.append("Here is the executive summary based on the active case dossier:\n")

        # Synthesize into clean readable text blocks
        main_body_sentences = []
        key_details = []

        for fact in extracted_facts:
            clean_text = fact.replace('|', ' • ').replace('  ', ' ').strip()
            if len(clean_text) > 30 and not clean_text.startswith('-'):
                if clean_text not in main_body_sentences:
                    main_body_sentences.append(clean_text)
            elif clean_text.startswith('-') or ' • ' in clean_text:
                if clean_text not in key_details:
                    key_details.append(clean_text)

        if main_body_sentences:
            paragraphs.append(" ".join(main_body_sentences[:4]))
            paragraphs.append("")

        if key_details:
            paragraphs.append("### Key Case Highlights")
            for item in key_details[:6]:
                paragraphs.append(f"• {item.lstrip('-').strip()}")
            paragraphs.append("")

        if not main_body_sentences and not key_details and extracted_facts:
            paragraphs.append(" ".join(extracted_facts[:5]))

        if not extracted_facts:
            paragraphs.append("The case files have been registered and processed. Upload additional forensic evidence files to view complete cross-entity intelligence.")

        return "\n".join(paragraphs)

    def generate_structured(self, prompt: str, system_prompt: str = None, temperature: float = 0.1) -> dict:
        """Generate structured JSON output from LLM."""
        if not self.client:
            return {}

        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=4096,
            response_mime_type="application/json",
        )
        if system_prompt:
            config.system_instruction = system_prompt

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=config,
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"[WARN] Gemini API structured call failed: {e}")
            return {}


# Singleton
llm = LLMProvider()
