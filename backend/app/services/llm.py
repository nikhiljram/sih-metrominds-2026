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
        """Question-aware conversational synthesis for distinct chatbot responses."""
        import re

        question = ""
        if "OFFICER'S QUESTION:" in prompt:
            q_part = prompt.split("OFFICER'S QUESTION:")[-1].strip()
            question = q_part.split("\n")[0].strip()

        q_lower = question.lower()
        stopwords = {'who', 'what', 'where', 'when', 'why', 'how', 'is', 'the', 'are', 'was', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'with', 'for', 'case', 'about'}
        keywords = [w for w in re.findall(r'\w+', q_lower) if w not in stopwords and len(w) > 2]

        lines = prompt.split('\n')
        
        # Clean lines removing headers and boilerplate disclaimer
        clean_lines = []
        for line in lines:
            stripped = line.strip().strip('"').strip("'")
            if not stripped or stripped.startswith('[') or stripped.startswith('---') or stripped.startswith('SYSTEM') or stripped.startswith('OFFICER') or stripped.startswith('CASE EVIDENCE'):
                continue
            if 'SYNTHETIC FORENSIC CASE REPORT' in stripped or 'IMPORTANT: This document is entirely fictional' in stripped or 'must not be treated as a real' in stripped:
                continue
            clean_lines.append(stripped)

        # 1. Answer "WHO" questions (Persons, Suspects, Entities)
        if 'who' in q_lower or any(kw in ['person', 'suspect', 'arun', 'ravi', 'people', 'individual'] for kw in keywords):
            person_lines = []
            for l in clean_lines:
                if any(kw in l.lower() for kw in keywords) or 'person' in l.lower() or 'ent-' in l.lower() or 'suspect' in l.lower() or 'interest' in l.lower():
                    person_lines.append(l)

            if person_lines:
                res = [f"### Entity & Person Profile: **{question}**\n"]
                res.append("Based on the evidence dossier, the following individuals and entity profiles were identified:\n")
                for pl in person_lines[:5]:
                    res.append(f"• **{pl.lstrip('-').replace('|', ' — ').strip()}**")
                return "\n".join(res)

        # 2. Answer "WHERE" questions (Location, Place, Address)
        if 'where' in q_lower or any(kw in ['location', 'place', 'address', 'area', 'maddur', 'near', 'city'] for kw in keywords):
            loc_lines = []
            for l in clean_lines:
                if any(kw in l.lower() for kw in keywords) or 'location' in l.lower() or 'maddur' in l.lower() or 'area' in l.lower() or 'near' in l.lower() or 'district' in l.lower():
                    loc_lines.append(l)

            if loc_lines:
                res = [f"### Incident Location & Spatial Intelligence\n"]
                res.append(f"Regarding **\"{question}\"**, the evidence dossier logs the following location details:\n")
                for ll in loc_lines[:5]:
                    res.append(f"• {ll.lstrip('-').replace('|', ' — ').strip()}")
                return "\n".join(res)

        # 3. Answer "WHAT" / "SUMMARY" questions (Incident Summary)
        if 'what' in q_lower or 'summary' in q_lower or 'incident' in q_lower:
            summary_lines = []
            for l in clean_lines:
                if 'summary' in l.lower() or 'incident' in l.lower() or 'alleged' in l.lower() or 'occurred' in l.lower() or 'threw' in l.lower() or 'vehicle' in l.lower() or len(l) > 40:
                    summary_lines.append(l)

            if summary_lines:
                res = [f"### Case Incident Summary\n"]
                res.append(" ".join(summary_lines[:3]))
                if len(summary_lines) > 3:
                    res.append("\n**Key Incident Details:**")
                    for sl in summary_lines[3:6]:
                        res.append(f"• {sl.lstrip('-').replace('|', ' — ').strip()}")
                return "\n".join(res)

        # 4. Fallback Keyword Matched Lines for Specific Queries
        matched = [l for l in clean_lines if keywords and any(kw in l.lower() for kw in keywords)]
        if matched:
            res = [f"### Findings for **\"{question}\"**\n"]
            for m in matched[:5]:
                res.append(f"• {m.lstrip('-').replace('|', ' — ').strip()}")
            return "\n".join(res)

        # Default fallback if no keyword match
        res = [f"### Case Summary Findings\n"]
        res.append("Here are the key recorded findings from the evidence file:\n")
        for cl in clean_lines[:5]:
            res.append(f"• {cl.lstrip('-').replace('|', ' — ').strip()}")
        return "\n".join(res)

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
