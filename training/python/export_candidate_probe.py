"""Export trusted local MLP checkpoints for isolated synchronous CPU experiments."""
import argparse
import hashlib
import json
from pathlib import Path
import torch

p = argparse.ArgumentParser()
p.add_argument('--models-dir', required=True)
p.add_argument('--tag', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
bundle = {'schema': 'candidate_probe.v1', 'heads': {}}
for head, prefix, output in [('place', 'policy-net', 'place_head'), ('card', 'policy-card', 'card_head'),
                             ('target', 'policy-target', 'target_head'), ('value', 'policy-value', 'value_head')]:
    base = Path(a.models_dir) / f'{prefix}.candidate.{a.tag}'
    checkpoint = Path(str(base) + '.checkpoint.pt')
    meta = json.loads(Path(str(base) + '.onnx.meta.json').read_text(encoding='utf-8'))
    state = torch.load(checkpoint, map_location='cpu', weights_only=True)['model_state']
    layers = []
    probe = torch.linspace(-1, 1, meta['inputDim']).reshape(1, -1)
    for name in ['backbone.0', 'backbone.2', output]:
        w, b = state[name + '.weight'], state[name + '.bias']
        layers.append({'weights': w.tolist(), 'bias': b.tolist()})
        probe = torch.nn.functional.linear(probe, w, b)
        if name != output:
            probe = torch.relu(probe)
    if head == 'value':
        probe = torch.tanh(probe)
    bundle['heads'][head] = {'meta': meta, 'layers': layers, 'tanh': head == 'value',
                            'sha256': hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
                            'golden': probe.flatten().tolist()}
out = Path(a.out)
out.parent.mkdir(parents=True, exist_ok=True)
with out.open('x', encoding='utf-8') as f:
    json.dump(bundle, f, separators=(',', ':'))
print(f'Exported four heads: {out}')
