# TinyStories (treapta 3 de date)

Fișierul nu este în git (19 MB). Descărcare:

```bash
curl -sSL --fail -o data/tinystories/TinyStories-valid.txt \
  https://huggingface.co/datasets/roneneldan/TinyStories/resolve/main/TinyStories-valid.txt
sha256sum data/tinystories/TinyStories-valid.txt
# 94e431816c4cce81ff71e4408ff8d3bda9a42e8d2663986697c3954288cb38b4
```

Sursa: Eldan și Li, 2023 (arXiv:2305.07759), fișierul de validare. Are 21.989 de povești, despărțite prin `<|endoftext|>`. Este scris de un LLM (vezi atenționarea din secțiunea 17).
