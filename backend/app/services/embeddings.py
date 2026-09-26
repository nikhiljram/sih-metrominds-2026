"""Embedding Service — Gemini embeddings for semantic search"""

from google import genai
from app.config import settings


class EmbeddingService:
    """Generate embeddings using Google Gemini embedding model."""

    def __init__ (self):
        if settings.GEMINI_API_KEY:
            try:
                self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                print(f"[WARN] Failed to initialize Gemini embedding client: {e}")
                self.client = None
        else:
            self.client = None
        self.model = settings.EMBEDDING_MODEL

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text string."""
        result = self.client.models.embed_content(
            model=self.model,
            contents=text,
        )
        return list(result.embeddings[0].values)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts in batch."""
        if not texts or not self.client:
            return []

        embeddings = []
        batch_size = 20
        try:
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                result = self.client.models.embed_content(
                    model=self.model,
                    contents=batch,
                )
                for emb in result.embeddings:
                    embeddings.append(list(emb.values))
        except Exception as e:
            print(f"[WARN] Batch embedding skipped: {e}")
            return []

        return embeddings

    def embed_query(self, query: str) -> list[float]:
        """Embed a search query (same as embed_text, but semantically clear)."""
        return self.embed_text(query)


# Singleton
embedding_service = EmbeddingService()
