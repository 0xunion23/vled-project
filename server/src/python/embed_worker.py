import json
import os
import sys

os.environ["TOKENIZERS_PARALLELISM"] = "false"

from transformers import AutoModel, AutoTokenizer
import torch


def clean_texts(texts):
    cleaned = [
        str(text).encode("utf-8", errors="ignore").decode("utf-8").strip()
        for text in texts
    ]
    return [text if len(text) >= 5 else "empty faq text" for text in cleaned]


def mean_pool(last_hidden_state, attention_mask):
    mask_expanded = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
    summed = torch.sum(last_hidden_state * mask_expanded, 1)
    counts = torch.clamp(mask_expanded.sum(1), min=1e-9)
    return summed / counts


def embed(texts, tokenizer, model):
    cleaned = clean_texts(texts)
    encoded = tokenizer(
        cleaned,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="pt",
    )

    with torch.no_grad():
        output = model(**encoded)
        embeddings = mean_pool(output.last_hidden_state, encoded["attention_mask"])
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)

    return embeddings.numpy().tolist()


def write_response(payload):
    print(json.dumps(payload), flush=True)


def main():
    model_name = os.environ.get("FLAG_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    model.eval()

    write_response({"type": "ready", "model": model_name})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            payload = json.loads(line)
            request_id = payload.get("id")
            texts = payload.get("texts", [])
            write_response(
                {
                    "id": request_id,
                    "embeddings": embed(texts, tokenizer, model),
                }
            )
        except Exception as error:
            write_response(
                {
                    "id": payload.get("id") if "payload" in locals() else None,
                    "error": str(error),
                }
            )


if __name__ == "__main__":
    main()
