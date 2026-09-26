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

        # Extract document chunk excerpts (lines starting with quote chars or source refs)
        lines = prompt.split('\n')
        doc_chunks = []
        current_source = None
        in_quote = False
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('[') and 'Source:' in stripped:
                current_source = stripped
                in_quote = True
                continue
            if in_quote and stripped.startswith('"'):
                content = stripped.strip('"').strip()
                if content:
                    doc_chunks.append((current_source, content))
                in_quote = False

        # Filter chunks by question keywords (skip generic filler words)
        stopwords = {'who', 'what', 'is', 'the', 'are', 'was', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'with', 'for'}
        keywords = [w for w in question.replace('?', '').replace(',', '').split() if w not in stopwords and len(w) > 2]

        relevant_chunks = []
        other_chunks = []
        for src, content in doc_chunks:
            lower_content = content.lower()
            if any(kw in lower_content for kw in keywords):
                relevant_chunks.append((src, content))
            else:
                other_chunks.append((src, content))

        # Combine: relevant first, then fill up to 4 total from others
        selected = (relevant_chunks + other_chunks)[:4]

        if not selected:
            return (
                "### Investigation Status\n\n"
                "No relevant evidence chunks were found in the uploaded case documents for your query.\n\n"
                "**Tip:** Upload evidence files (PDFs, CSVs, docs) under the **Documents** tab "
                "to enable AI-powered search and analysis."
            )

        # Build entity section (only those mentioned in question or top entities)
        entity_lines = []
        in_entities = False
        for line in lines:
            stripped = line.strip()
            if 'KNOWN ENTITIES' in stripped:
                in_entities = True
                continue
            if 'KNOWN RELATIONSHIPS' in stripped:
                in_entities = False
                continue
            if in_entities and stripped.startswith('-'):
                # Show only if question keyword matches entity line
                lower_line = stripped.lower()
                if keywords and any(kw in lower_line for kw in keywords):
                    entity_lines.append(stripped)

        # Build relationship section (only those involving question keywords)
        rel_lines = []
        in_rels = False
        for line in lines:
            stripped = line.strip()
            if 'KNOWN RELATIONSHIPS' in stripped:
                in_rels = True
                continue
            if in_rels and stripped.startswith('-'):
                lower_line = stripped.lower()
                if keywords and any(kw in lower_line for kw in keywords):
                    rel_lines.append(stripped)

        # Compose structured response
        response_parts = []
        response_parts.append("### Executive Summary")
        if question:
            response_parts.append(f"Based on the case evidence, here is what was found regarding: *\"{question.title()}\"*\n")

        response_parts.append("### Key Evidence Findings")
        for i, (src, content) in enumerate(selected, 1):
            src_clean = src.replace('[', '').replace(']', '').strip() if src else f'Document {i}'
            # Truncate long content for readability
            excerpt = content[:400] + ('...' if len(content) > 400 else '')
            response_parts.append(f"**[{i}] {src_clean}:**")
            response_parts.append(f"> {excerpt}\n")

        if entity_lines:
            response_parts.append("### Relevant Entities")
            for el in entity_lines[:8]:
                response_parts.append(el)
            response_parts.append("")

        if rel_lines:
            response_parts.append("### Identified Connections")
            for rl in rel_lines[:6]:
                response_parts.append(rl)
            response_parts.append("")

        response_parts.append("---")
        response_parts.append("*Note: This is an extractive summary from case documents. Connect a Gemini API key for full AI-synthesized analysis.*")

        return "\n".join(response_parts)

    def generate_structured(self, prompt: str, system_prompt: str = None, temperature: float = 0.1) -> dict:
        """Generate structured JSON output from LLM."""
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=4096,
            response_mime_type="application/json",
        )
        if system_prompt:
            config.system_instruction = system_prompt

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=config,
        )

        try:
            return json.loads(response.text)
        except json.JSONDecodeError:
            # Fallback: try to extract JSON from the response
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            return json.loads(text.strip())


# Singleton
llm = LLMProvider()
