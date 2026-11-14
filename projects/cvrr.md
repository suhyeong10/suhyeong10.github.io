---
layout: project
title: "Reason Through the Latent! Making Latent Visual Reasoning Necessary"
short_title: CVRR
nav: blog
permalink: /blog/projects/cvrr/
project_card: true
summary: "Causal Visual Recurrent Reasoning makes a recurrent question state the only route for visual evidence to reach the answer."
authors:
  - Suhyeong Park
  - Junha Jung
  - Jaewoo Kang
venue: Preprint
year: 2026
publication_date: '2026-09-06'
paper: https://arxiv.org/abs/2609.06746
model: https://huggingface.co/collections/dmis-lab/cvrr
code: https://github.com/dmis-lab/CVRR
figure: /assets/projects/cvrr-figure.webp
figure_width: 1500
figure_height: 525
figure_alt: "CVRR architecture showing image and question encoding, repeated question updates with fixed visual states, and answer decoding from the last question state."
figure_caption: "CVRR revisits the same visual evidence as the question state evolves. The final state carries visual information into the answer decoder."
figure_source: https://arxiv.org/html/2609.06746v3#S2.F2
figure_license: https://creativecommons.org/licenses/by/4.0/
figure_credit: "Figure 2 from Park, Jung, and Kang (2026), resized and re-encoded as WebP, CC BY 4.0."
---

## When does a model use its latent reasoning?

A vision-language model can encode visual evidence in a hidden state and still answer through its original image context. In our initial experiments, replacing the latent state with noise or a mismatched example barely changed accuracy for some methods. We designed CVRR to test whether a model could preserve its visual reasoning ability when the answer actually had to use the recurrent state. [Preliminary experiments](https://arxiv.org/html/2609.06746v3#S2)

## How CVRR works

1. **Start from the pretrained model’s question state.** Swapping visual activations between paired images helps locate the layer where the question tokens already carry the visual evidence needed for the task.
2. **Revisit fixed visual evidence.** A shared decoder layer updates the question state repeatedly. At each step, its existing attention mechanism can consult the same visual tokens with the updated question state.
3. **Decode from the final state.** The answer decoder receives the last recurrent question state and a text-only cache. The original visual tokens and multimodal cache are removed before decoding.

The backbone stays frozen, with low-rank adapters trained only on the shared transition layer. The training signal is answer-token cross-entropy. [Method and training](https://arxiv.org/html/2609.06746v3#S3)

## What the experiments show

| Benchmark | CVRR | Best retrained latent baseline with the same decoder constraint |
| --- | ---: | ---: |
| V★ overall accuracy | 81.2% | 39.8% |
| MMVP pair accuracy | 52.7% | 2.7% |
| BLINK overall accuracy | 55.2% | 38.8% |
| MME-RealWorld-Lite overall accuracy | 46.7% | 33.1% |

On MMVP, a pair counts as correct only when the model answers both image questions correctly. Removing visual access during the recurrent steps and retraining reduced that score from 52.7% to 18.0%. In a separate test, swapping the final state between images that shared the exact same question substantially changed the answer. Together, these tests show that the updates use the image and carry evidence that influences the final prediction. [Benchmark results](https://arxiv.org/html/2609.06746v3#S4) · [Causal analysis](https://arxiv.org/html/2609.06746v3#S5)

The boundary is selected separately for each backbone. The paper’s mechanistic tests mainly cover multiple-choice tasks and use the visual evidence available at initialization. [Limitations](https://arxiv.org/html/2609.06746v3#S6)
