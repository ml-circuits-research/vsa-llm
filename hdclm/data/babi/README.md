# bAbI, sarcina 1 (un fapt sprijinitor)

Sursa: Weston și alții, 2015 (arXiv:1502.05698), varianta `en-qa1` (1k exemple), luată de pe Hugging Face (`facebook/babi_qa`, fișierele parquet), convertită o singură dată în JSONL. Licență CC BY 3.0.

```
curl -sSL -o qa1_train.parquet https://huggingface.co/api/datasets/facebook/babi_qa/parquet/en-qa1/train/0.parquet
curl -sSL -o qa1_test.parquet  https://huggingface.co/api/datasets/facebook/babi_qa/parquet/en-qa1/test/0.parquet
# conversie (pandas + pyarrow): fiecare poveste -> {"lines": [{"type": 0|1, "text", "answer"}]}
```

SHA-256: qa1_train.jsonl 4c948e6d…, qa1_test.jsonl f0bde941… (vezi `sha256sum`).
