---
layout: project
title: "Leveraging Knowledge Graph-Enhanced LLMs for Context-Aware Medical Consultation"
short_title: ILlama
nav: blog
permalink: /blog/projects/illama/
project_card: true
summary: "A retrieval-augmented language model grounded in a structured medical knowledge graph."
authors:
  - Su-Hyeong Park
  - Ho-Beom Kim
  - Seong-Jin Park
  - Dinara Aliyeva
  - Kang-Min Kim
author_note: "Su-Hyeong Park and Ho-Beom Kim contributed equally."
venue: EMNLP
year: 2025
publication_date: '2025-11'
paper: https://aclanthology.org/2025.emnlp-main.1549/
code: https://github.com/suhyeong10/ILlama
figure: /assets/projects/illama-figure.webp
figure_width: 1130
figure_height: 366
figure_alt: "ILlama extracts subgraphs from a medical knowledge graph, converts them to text, and retrieves and reranks evidence for a language model."
figure_caption: "ILlama builds a searchable collection of medical subgraphs and retrieves relevant evidence for each question."
figure_source: https://aclanthology.org/2025.emnlp-main.1549.pdf#page=4
figure_license: https://aclanthology.org/faq/copyright/
figure_credit: "Figure 1 from Park et al. (EMNLP 2025), cropped from the paper and converted to WebP."
---

## Why use a medical knowledge graph?

Clinical questions often describe a combination of symptoms in everyday language. ILlama studies whether explicitly retrieving relationships among symptoms, conditions, and treatments can improve a model’s responses to these questions. [Paper](https://aclanthology.org/2025.emnlp-main.1549/)

## How ILlama works

1. **Build searchable documents from a graph.** The system takes a relationship from a UMLS-based medical knowledge graph, gathers its nearby connections, and turns the resulting subgraph into a short document.
2. **Retrieve and rerank the evidence.** A domain-tuned embedding model retrieves candidate documents through FAISS. A cross-encoder scores the question and each candidate together.
3. **Generate a response with the retrieved context.** A fine-tuned language model uses the top-ranked documents as context for its answer.

The authors also generate patient-style questions from the subgraph documents and filter them for relevance before training the retriever and reranker. [Method, §3](https://aclanthology.org/2025.emnlp-main.1549.pdf#page=3)

## Results

| Model | HealthCareMagic F1 | iCliniq F1 |
| --- | ---: | ---: |
| ChatDoctor | 0.846 | 0.845 |
| ILlama 8B | 0.884 | 0.871 |
| IGemma 27B | 0.897 | 0.881 |

The table reports the paper’s semantic similarity F1 against reference responses. It evaluates answer similarity on two datasets. The paper also reports that subgraph retrieval performed better than full-graph retrieval, and discusses limits in language and disease coverage. [Results, Table 2](https://aclanthology.org/2025.emnlp-main.1549.pdf#page=6) · [Limitations](https://aclanthology.org/2025.emnlp-main.1549.pdf#page=9)
