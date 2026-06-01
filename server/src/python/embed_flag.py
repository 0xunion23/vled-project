import json
import os
import sys

from FlagEmbedding import FlagModel


def main():
    payload = json.load(sys.stdin)
    texts = payload.get("texts", [])
    model_name = payload.get("model") or os.environ.get(
        "FLAG_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"
    )

    model = FlagModel(
        model_name,
        normalize_embeddings=True,
        query_instruction_for_retrieval="Represent this sentence for searching relevant passages:",
        use_fp16=False,
    )

    embeddings = model.encode(texts)
    print(json.dumps({"embeddings": embeddings.tolist()}))


if __name__ == "__main__":
    main()
