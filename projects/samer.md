---
layout: project
title: "Do All Visual Tokens Matter Equally? Object-Evidence Preserving Token Merging for Vision-Language Retrieval"
short_title: SaMer
nav: blog
permalink: /blog/projects/samer/
project_card: true
summary: "Compress dense visual tokens for image retrieval while retaining the evidence a future query may need."
authors:
  - Suhyeong Park
  - Junha Jung
  - Jungwoo Park
  - Jaewoo Kang
venue: Preprint
year: 2026
publication_date: '2026-07-06'
paper: https://arxiv.org/abs/2607.04605
model: https://huggingface.co/collections/dmis-lab/samer
code: https://github.com/dmis-lab/SaMer
figure: /assets/projects/samer-figure.webp
figure_width: 1453
figure_height: 531
figure_alt: "SaMer architecture showing frozen vision and text encoders, a trainable shared projector, visual token merging, and MaxSim ranking."
figure_credit: "Figure 1 by Park et al., CC BY 4.0. Cropped to remove the original caption and converted to WebP."
figure_source: https://arxiv.org/pdf/2607.04605v3#page=3
figure_license: https://creativecommons.org/licenses/by/4.0/
---

## The retrieval problem

Multi-vector retrievers keep an embedding for each visual token. During search, MaxSim matches each text token against the image tokens and uses the strongest match to score the image. This makes it possible to find a small object or attribute mentioned in a query, but searching a large collection requires storing and comparing many vectors. A compact image representation still needs to preserve evidence for queries that have yet to be written. [Paper, §§1–3](https://arxiv.org/pdf/2607.04605v3#page=1)

## How SaMer works

1. **Merge after projection.** SaMer softly assigns visual tokens to a smaller set of centroids using both embedding similarity and spatial proximity. The query tokens and MaxSim scoring stay the same.
2. **Use object annotations during training.** An instance-consistency penalty discourages grouping tokens from different objects into one centroid. At inference, only the image features and token positions are needed.
3. **Train the shared projector.** A contrastive retrieval objective adapts the layer that puts visual and textual features in a shared space. Both encoders remain frozen.

[Method and training details in the paper](https://arxiv.org/pdf/2607.04605v3#page=3)

## Results

With ColPali, SaMer reduces the visual representation from 1,030 to 64 tokens per image. Estimated FP16 embedding storage for one million images drops from **263.7 GB to 16.4 GB**, a **16.09× reduction**. [Paper, Table 8](https://arxiv.org/pdf/2607.04605v3#page=12)

| Benchmark | ColPali R@1 | ColPali + SaMer R@1 |
| --- | ---: | ---: |
| Flickr30K | 77.0 | **82.4** |
| MSCOCO | 47.4 | **51.6** |
| ImageCoDe | 5.4 | **5.9** |
| DocVQA | **51.0** | 45.7 |

On DocVQA, the fixed token budget lowers retrieval accuracy. The paper identifies broad textual and spatial coverage as important for that benchmark. [Paper, Table 1](https://arxiv.org/pdf/2607.04605v3#page=5)

## Ablation and phrase grounding

At 64 tokens, adding object-instance supervision to the feature-and-spatial merge improves both retrieval and grounding. BoxMass measures how much phrase relevance falls within the annotated region. Coverage IoU measures how closely the highlighted area overlaps that region. [Paper, Table 4 and grounding analysis](https://arxiv.org/pdf/2607.04605v3#page=7)

| Merge components | Flickr30K R@1 | MSCOCO R@1 | BoxMass | Coverage IoU |
| --- | ---: | ---: | ---: | ---: |
| Feature similarity | 80.7 | 49.8 | 47.6 | 13.0 |
| Feature similarity + position | 80.4 | 49.8 | 47.8 | 13.1 |
| Feature similarity + position + object prior | **82.4** | **51.6** | **54.2** | **16.4** |

The 64-token setting removes 93.79% of ColPali's visual tokens. Increasing the budget eightfold from 64 to 512 raises R@5 from 96.3 to 96.8 on Flickr30K and from 75.5 to 76.1 on MSCOCO. [Paper, Table 3](https://arxiv.org/pdf/2607.04605v3#page=6)

See the [original project page](https://suhyeong10.github.io/samer-project-page/) for qualitative phrase-grounding examples.

## Citation

```bibtex
@misc{park2026visualtokensmatterequally,
  title = {Do All Visual Tokens Matter Equally? Object-Evidence Preserving Token Merging for Vision-Language Retrieval},
  author = {Park, Suhyeong and Jung, Junha and Park, Jungwoo and Kang, Jaewoo},
  year = {2026},
  eprint = {2607.04605},
  archivePrefix = {arXiv},
  primaryClass = {cs.IR},
  url = {https://arxiv.org/abs/2607.04605}
}
```
