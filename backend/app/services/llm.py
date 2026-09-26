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
        """Smarter question-aware extractive fallback when Gemini API is offline/unavailable."""
        # Extract the question from the prompt
        question = ""
        question_marker = "OFFICER'S QUESTION:"
        if question_marker in prompt:
            q_part = prompt.split(question_marker)[-1].strip()
            question = q_part.split("\n")[0].strip().lower()

        stopwords = {'who', 'what', 'is', 'the', 'are', 'was', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'with', 'for'}
        keywords = [w for w in question.replace('?', '').replace(',', '').split() if w not in stopwords and len(w) > 2]

        lines = prompt.split('\n')
        doc_chunks = []
        current_source = None
        buffer = []

        for line in lines:
            stripped = line.strip()
            if stripped.startswith('[') and 'Source:' in stripped:
                if current_source and buffer:
                    doc_chunks.append((current_source, "\n".join(buffer)))
                    buffer = []
                current_source = stripped
                continue
            if current_source and stripped:
                cleaned = stripped.strip('"').strip()
                if cleaned and not cleaned.startswith('---'):
                    buffer.append(cleaned)

        if current_source and buffer:
            doc_chunks.append((current_source, "\n".join(buffer)))

        # Find entity profiles and matches
        matched_profiles = []
        matched_rels = []
        matched_excerpts = []

        for src, content in doc_chunks:
            chunk_lines = [l.strip() for l in content.split('\n') if l.strip()]
            for l in chunk_lines:
                lower_l = l.lower()
                if keywords and any(kw in lower_l for kw in keywords):
                    # Check if pipe-separated table row
                    if '|' in l and not l.startswith('person_id') and not l.startswith('source_id'):
                        parts = [p.strip() for p in l.split('|')]
                        if len(parts) >= 3:
                            matched_profiles.append((src, parts))
                    else:
                        matched_excerpts.append((src, l))

        # Known entities / relationships in prompt
        in_entities = False
        in_rels = False
        for line in lines:
            stripped = line.strip()
            if 'KNOWN ENTITIES' in stripped:
                in_entities = True; in_rels = False; continue
            if 'KNOWN RELATIONSHIPS' in stripped:
                in_rels = True; in_entities = False; continue
            if in_entities and stripped.startswith('-'):
                if keywords and any(kw in stripped.lower() for kw in keywords):
                    matched_rels.append(stripped)
            if in_rels and stripped.startswith('-'):
                if keywords and any(kw in stripped.lower() for kw in keywords):
                    matched_rels.append(stripped)

        # Build response
        response_parts = ["### Executive Summary"]
        q_display = question.title() if question else "Case Query"
        response_parts.append(f"Based on case evidence, here is the investigation profile for **\"{q_display}\"**:\n")

        if matched_profiles:
            response_parts.append("### Key Entity Profile")
            for src, parts in matched_profiles[:5]:
                profile_str = " • ".join(parts)
                response_parts.append(f"- **Profile Data:** {profile_str}")
            response_parts.append("")

        if matched_rels:
            response_parts.append("### Direct Connections & Relational Evidence")
            for rel in matched_rels[:6]:
                response_parts.append(f"{rel}")
            response_parts.append("")

        if matched_excerpts:
            response_parts.append("### Relevant Document Excerpts")
            for src, excerpt in matched_excerpts[:4]:
                src_name = src.replace('[', '').replace(']', '').strip() if src else 'Case Document'
                response_parts.append(f"**{src_name}:**")
                response_parts.append(f"> {excerpt}\n")

        if not matched_profiles and not matched_rels and not matched_excerpts:
            response_parts.append("### Relevant Evidence Findings")
            for i, (src, content) in enumerate(doc_chunks[:3], 1):
                src_name = src.replace('[', '').replace(']', '').strip() if src else f'Source {i}'
                response_parts.append(f"**[{i}] {src_name}:**")
                first_lines = "\n".join(content.split('\n')[:4])
                response_parts.append(f"> {first_lines}\n")

        response_parts.append("---")
        response_parts.append("*Note: Extractive analysis directly grounded on active case files.*")

        return "\n".join(response_parts)

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
