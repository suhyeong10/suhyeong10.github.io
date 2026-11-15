---
layout: project
title: |-
  Reason Through the Latent!
  Making Latent Visual Reasoning Necessary
short_title: CVRR
nav: blog
permalink: /blog/projects/cvrr/
project_card: true
summary: "Causal Visual Recurrent Reasoning makes a recurrent question state the only route for visual evidence to reach the answer."
authors:
  - Suhyeong Park
  - Junha Jung
  - Jaewoo Kang
corresponding_authors:
  - Jaewoo Kang
venue: Preprint
year: 2026
publication_date: '2026-09-06'
paper: https://arxiv.org/pdf/2609.06746
model: https://huggingface.co/collections/dmis-lab/cvrr
code: https://github.com/dmis-lab/CVRR
figure: /assets/projects/cvrr-figure.webp
figure_width: 1500
figure_height: 525
figure_alt: "CVRR architecture showing image and question encoding, repeated question updates with fixed visual states, and answer decoding from the last question state."
figure_caption: "CVRR revisits the same visual evidence as the question state evolves. The final state carries visual information into the answer decoder."
figure_source: https://arxiv.org/pdf/2609.06746v3#page=3
figure_license: https://creativecommons.org/licenses/by/4.0/
figure_credit: "Figure 2 from Park, Jung, and Kang (2026), resized and re-encoded as WebP, CC BY 4.0."
---

## Abstract {#abstract}

Causal Visual Recurrent Reasoning (CVRR) tests whether a vision-language model can retain visual reasoning ability when it has to answer through a recurrent hidden state. The model starts with a question representation formed by the pretrained backbone, updates that representation against the image several times, and decodes through the final state. Across four benchmarks, CVRR outperformed retrained latent reasoning baselines subject to the same decoder constraint. [Paper](https://arxiv.org/pdf/2609.06746)

## When does a model use its latent reasoning? {#problem}

A model can encode the right visual evidence in a hidden state while its answer still depends on the original image context. In preliminary experiments, replacing a latent state with noise or a state from a mismatched example barely changed accuracy for some methods. The resulting question was whether an answer could be made to depend on the latent state while preserving the image understanding learned during pretraining. [Preliminary experiments](https://arxiv.org/pdf/2609.06746v3#page=2)

## How CVRR works {#method}

1. **Start from the pretrained model’s question state.** Swapping visual activations between paired images helps locate the layer where the question tokens already carry the visual evidence needed for the task.
2. **Revisit fixed visual evidence.** A shared decoder layer updates the question state repeatedly. At each step, its existing attention mechanism can consult the same visual tokens with the updated question state.
3. **Decode from the final state.** The answer decoder receives the last recurrent question state and a text-only cache. The original visual tokens and multimodal cache are removed before decoding.

The backbone stays frozen, with low-rank adapters trained only on the shared transition layer. The training signal is answer-token cross-entropy. [Method and training](https://arxiv.org/pdf/2609.06746v3#page=4)

## Main results {#results}

The comparison uses a decoder that can receive image-conditioned information only through the latent state. On MMVP, a pair counts as correct when the model answers both image questions correctly. [Benchmark protocol and results](https://arxiv.org/pdf/2609.06746v3#page=5)

| Benchmark | CVRR | Best retrained latent baseline |
| --- | ---: | ---: |
| V★ overall accuracy | 81.2% | 39.8% |
| MMVP pair accuracy | 52.7% | 2.7% |
| BLINK overall accuracy | 55.2% | 38.8% |
| MME-RealWorld-Lite overall accuracy | 46.7% | 33.1% |

## What the recurrent state carries {#analysis}

### Image access during recurrence

Removing visual access during the recurrent steps and retraining reduced MMVP pair accuracy from 52.7% to 18.0%. This test starts from the same kind of multimodal question state and isolates the contribution of rereading the image during the updates. [Component analysis](https://arxiv.org/pdf/2609.06746v3#page=7)

### A fixed question with different evidence

For MMVP image pairs that shared the same question, swapping in the competing image’s final state reduced accuracy in the intervention experiment from 73.3% to 26.7%. Holding the question fixed isolates the effect of changing the visual evidence carried by the state. [State replacement experiment](https://arxiv.org/pdf/2609.06746v3#page=8)

### Scope

The visual-read boundary is selected separately for each backbone. The mechanistic tests mainly cover multiple-choice tasks, and the model reuses the visual evidence available at initialization. [Limitations](https://arxiv.org/pdf/2609.06746v3#page=9)

## Resources and citation {#resources}

- [Code and reproduction instructions](https://github.com/dmis-lab/CVRR)
- [Model checkpoints](https://huggingface.co/collections/dmis-lab/cvrr)
- [Paper](https://arxiv.org/pdf/2609.06746)

### BibTeX

```bibtex
@misc{park2026reasonlatentmakinglatent,
  title = {Reason Through the Latent! Making Latent Visual Reasoning Necessary},
  author = {Park, Suhyeong and Jung, Junha and Kang, Jaewoo},
  year = {2026},
  eprint = {2609.06746},
  archivePrefix = {arXiv},
  primaryClass = {cs.AI},
  url = {https://arxiv.org/abs/2609.06746}
}
```
