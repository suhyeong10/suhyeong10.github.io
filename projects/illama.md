---
layout: project
title: |-
  Leveraging Knowledge Graph-Enhanced LLMs for
  Context-Aware Medical Consultation
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
co_first_authors:
  - Su-Hyeong Park
  - Ho-Beom Kim
corresponding_authors:
  - Kang-Min Kim
venue: EMNLP
year: 2025
publication_date: '2025-11'
paper: https://aclanthology.org/2025.emnlp-main.1549/
model: https://huggingface.co/collections/Codingchild/illama
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

## Abstract {#abstract}

ILlama uses a medical knowledge graph as a source of evidence for retrieval-augmented language models. It converts local graph neighborhoods into searchable text, retrieves and reranks the documents for each patient-style question, and gives the selected evidence to the generator. In the paper’s evaluation, ILlama 8B reached semantic similarity F1 of 0.884 on HealthCareMagic and 0.871 on iCliniq. [Paper](https://aclanthology.org/2025.emnlp-main.1549/)

## Why use a medical knowledge graph? {#problem}

Clinical questions often describe a combination of symptoms in everyday language. ILlama studies whether explicitly retrieving relationships among symptoms, conditions, and treatments can improve a model’s responses to these questions. [Paper](https://aclanthology.org/2025.emnlp-main.1549/)

## How ILlama works {#method}

1. **Build searchable documents from a graph.** The system takes a relationship from a UMLS-based medical knowledge graph, gathers its nearby connections, and turns the resulting subgraph into a short document.
2. **Retrieve and rerank the evidence.** A domain-tuned embedding model retrieves candidate documents through FAISS. A cross-encoder scores the question and each candidate together.
3. **Generate a response with the retrieved context.** A fine-tuned language model uses the top-ranked documents as context for its answer.

The authors also generate patient-style questions from the subgraph documents and filter them for relevance before training the retriever and reranker. [Method, §3](https://aclanthology.org/2025.emnlp-main.1549.pdf#page=3)

## Main results {#results}

The paper compares generated answers against reference responses on two medical consultation datasets using semantic similarity F1. [Paper, Table 2](https://aclanthology.org/2025.emnlp-main.1549.pdf#page=6)

| Model | HealthCareMagic F1 | iCliniq F1 |
| --- | ---: | ---: |
| ChatDoctor | 0.846 | 0.845 |
| ILlama 8B | 0.884 | 0.871 |
| IGemma 27B | 0.897 | 0.881 |

## What changes when retrieval changes? {#analysis}

### Graph neighborhoods and reranking

In the paper’s component analysis, removing reranking from the UMLS-based ILlama 8B pipeline lowered F1 from 0.884 to 0.857. The paper also found that retrieving focused subgraphs outperformed its full-graph retrieval comparison. [Paper, Table 3 and Figure 7](https://aclanthology.org/2025.emnlp-main.1549.pdf#page=9)

### Scope

The paper identifies narrow disease and language coverage, the risk of an outdated knowledge graph, and the need for evaluation of clinical safety and decision quality beyond answer-similarity metrics. [Limitations](https://aclanthology.org/2025.emnlp-main.1549.pdf#page=9)

## Resources and citation {#resources}

- [Code](https://github.com/suhyeong10/ILlama)
- [ACL Anthology](https://aclanthology.org/2025.emnlp-main.1549/)

### BibTeX

```bibtex
@inproceedings{park-etal-2025-leveraging-knowledge,
  title = {Leveraging Knowledge Graph-Enhanced {LLM}s for Context-Aware Medical Consultation},
  author = {Park, Su-Hyeong and Kim, Ho-Beom and Park, Seong-Jin
            and Aliyeva, Dinara and Kim, Kang-Min},
  booktitle = {Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing},
  month = nov,
  year = {2025},
  address = {Suzhou, China},
  publisher = {Association for Computational Linguistics},
  pages = {30459--30475},
  doi = {10.18653/v1/2025.emnlp-main.1549},
  url = {https://aclanthology.org/2025.emnlp-main.1549/}
}
```
