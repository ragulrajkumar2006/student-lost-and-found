"""
Embedding service for the Student Lost and Found system.

A tiny FastAPI app that loads the sentence-transformers model ONCE at
start-up and turns text into 384-dimensional vectors. The Node.js
backend calls it over HTTP, so Python owns the ML model and Node owns
the application logic.

Run (from the project root, with the venv):
    ./venv/bin/uvicorn app:app --app-dir embedding-service --port 8001
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

app = FastAPI(title="Lost and Found Embedding Service")
model = SentenceTransformer(MODEL_NAME)
DIMENSIONS = model.get_sentence_embedding_dimension()


class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=64)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "dimensions": DIMENSIONS}


@app.post("/embed")
def embed(request: EmbedRequest):
    texts = [text.strip() for text in request.texts]
    if any(not text for text in texts):
        raise HTTPException(status_code=400, detail="Texts must not be empty")

    # normalize_embeddings=True gives unit-length vectors, which is what
    # Cosine distance in Qdrant expects
    vectors = model.encode(texts, normalize_embeddings=True).tolist()
    return {"model": MODEL_NAME, "dimensions": DIMENSIONS, "vectors": vectors}
