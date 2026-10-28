import logging
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger("careerbridge-ai.embedding_model")

MODEL_NAME = "all-MiniLM-L6-v2"

# Module-level singleton instance
_model: SentenceTransformer | None = None


def _load_model() -> SentenceTransformer:
    """Load SentenceTransformer model into singleton module variable."""
    global _model
    if _model is None:
        logger.info("Loading SentenceTransformer model '%s'...", MODEL_NAME)
        _model = SentenceTransformer(MODEL_NAME)
        logger.info("SentenceTransformer model '%s' loaded successfully.", MODEL_NAME)
    return _model


# Load model once when the module is first imported
_model = _load_model()


def get_model() -> SentenceTransformer:
    """
    Return the cached SentenceTransformer singleton instance.
    Ensures model is loaded without re-instantiating.
    """
    global _model
    if _model is None:
        _model = _load_model()
    return _model


def embed_texts(texts: list[str]) -> np.ndarray:
    """
    Batch-encode a list of strings into sentence embeddings.

    Args:
        texts: List of text strings to embed.

    Returns:
        2D numpy ndarray of shape (len(texts), embedding_dim).
        Returns empty array of shape (0, 384) if texts list is empty.
    """
    if not texts:
        return np.empty((0, 384), dtype=np.float32)

    model = get_model()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    return embeddings
