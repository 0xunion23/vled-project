# this script is not used, replaced by embed_flag_worker.py for better performance and error handling(to improve latency). 
# Keeping it here for reference and potential future use.
import json
import os
import sys

os.environ["TOKENIZERS_PARALLELISM"] = "false"


def main():
    payload = json.load(sys.stdin)
    texts = payload.get("texts", [])
    # Ensure all inputs are clean non-empty strings, encode/decode to strip bad chars
    texts = [str(t).encode("utf-8", errors="ignore").decode("utf-8").strip() for t in texts]
    texts = [t if len(t) >= 5 else "empty faq text" for t in texts]

    if not texts:
        print(json.dumps({"embeddings": []}))
        return

    model_name = payload.get("model") or os.environ.get(
        "FLAG_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"
    )

    from transformers import AutoTokenizer, AutoModel
    import torch

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    model.eval()

    all_embeddings = []

    # Process one at a time to avoid batch encoding issues
    for text in texts:
        encoded = tokenizer(
            text,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt"
        )
        with torch.no_grad():
            output = model(**encoded)
            token_embeddings = output.last_hidden_state
            attention_mask = encoded["attention_mask"]
            mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
            embedding = torch.sum(token_embeddings * mask_expanded, 1) / torch.clamp(mask_expanded.sum(1), min=1e-9)
            embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)
            all_embeddings.append(embedding[0].numpy().tolist())

    print(json.dumps({"embeddings": all_embeddings}))


if __name__ == "__main__":
    main()
