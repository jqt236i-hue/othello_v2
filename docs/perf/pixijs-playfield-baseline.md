# PixiJS playfield migration DOM baseline

- Status: active pre-migration baseline
- Commit: `7435ad43fb35e349815958c82d11679af82f93b7`
- Captured at: 2026-07-22T10:01:44.297Z
- Node: v24.12.0
- Platform: win32 x64
- Scope: classic/Vite DOM pixels and semantic render digests, topology/client rects, playback/event settlement, network visual state, performance, and selector dependencies

## Browser lane captures

| lane | browser version | first board / app ready ms | captures | multi-flip p50 / p95 ms | 16x16 apply ms | fixture digest |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| classic | 143.0.7499.4 | 737.8 / 1021 | 19 | 21 / 23.7 | 235.7 | `d6bbd32e8511b985a7042643fc4e133d77a58b3540eb2eaefccdd394a3f01a6d` |
| vite | 143.0.7499.4 | 626.4 / 734 | 19 | 22.6 / 30.3 | 252.2 | `d6bbd32e8511b985a7042643fc4e133d77a58b3540eb2eaefccdd394a3f01a6d` |

- Classic/Vite pixel parity: PASS
- Classic/Vite semantic parity: PASS

## Topology fixtures

| fixture | config | existing | holes | digest |
| --- | --- | ---: | ---: | --- |
| rectangle-4x4 | 4x4 rectangle | 16 | 0 | `df740bf623dbda39e6be61d032c513d4d2e8c446f52db0f0a8bd51340a4863ab` |
| rectangle-4x16 | 4x16 rectangle | 64 | 0 | `1d03ccdb2f907b988fcbce866ecd8a1b97a2987e703195afcb09f799f4ed506c` |
| rectangle-16x4 | 16x4 rectangle | 64 | 0 | `afd78fbeadef9223cc07065d660fcb07486e69a0f357b511bce0d5ff047feb4a` |
| rectangle-7x7 | 7x7 rectangle | 49 | 0 | `c81f35aacda607f6287f54ed8d6a45ecaf6191871f4dc79df7501fb8f7a597e7` |
| rectangle-8x8 | 8x8 rectangle | 64 | 0 | `0c0171d6df1f813de26444c4930f8bfed044bae725d310f8d1089560013b04cc` |
| rectangle-16x16 | 16x16 rectangle | 256 | 0 | `e7a4f85972b143796817656ce5f2aea657e52da949e27835ff41c0d0792eb357` |
| circle-6 | 6x6 circle | 32 | 0 | `77a3610f5262d71ade6fcb28e86d207a376ffc7e932a21df3c353cc025892e62` |
| circle-8 | 8x8 circle | 52 | 0 | `3ad91ed75ecd51447bf98e1a28ce95c1770566d72f914edc52b17eb83e70ab99` |
| circle-10 | 10x10 circle | 80 | 0 | `250bfee423255a6f71da848e1ee1fbc2642a8bae142fd6d4a295df289d998dc6` |
| circle-12 | 12x12 circle | 112 | 0 | `81ba270f61bc175d5990fd2fae9e8342a7316d8a315a9fe37aa72eb579f3197d` |
| circle-14 | 14x14 circle | 156 | 0 | `fac97e45474a056ac283fa7cddba8ef14dbaf4f9904cbc9a6d9eb9a6a674e618` |
| circle-16 | 16x16 circle | 208 | 0 | `4640c6ee57c9e4f043d8ca12e2f1b85d84620f7b9ad77edea55ea8238821137e` |
| rectangle-8x8-hole | 8x8 rectangle | 64 | 2 | `c7fcfbd25f2c8eb765b46e32b93bf2f42b3346984aa5ca8a4348dca36ecefee3` |
| rectangle-8x8-multistage-expansion | 8x8 rectangle | 69 | 0 | `b0ce4eaecf8bf535e4fef1aaaaf7562848121c681940ddbb921efa2ef3bf529a` |

## Playback event settlement

| mode | phase completion order | sound keys | final board digest |
| --- | --- | ---: | --- |
| normal | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 | 9 | `80fe11faf0d79b2fe7ca08f916f498289746748bde1b597816655ddb642f03d0` |
| reduced-motion | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 | 9 | `80fe11faf0d79b2fe7ca08f916f498289746748bde1b597816655ddb642f03d0` |
| NOANIM=1 | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 | 9 | `80fe11faf0d79b2fe7ca08f916f498289746748bde1b597816655ddb642f03d0` |

## Network visual-state settlement

| scenario | final visual digest | scenario digest |
| --- | --- | --- |
| reconnect-journal-gap-recovery | `a267531da205a83851c9c9028be5d41441d11748b3141400993fbbb688f383e1` | `868bffaf690284ba897c9d480395cb2a1b152b393f5777bc3a38908d2c4d908f` |
| late-snapshot-base-cursor-advance | `a267531da205a83851c9c9028be5d41441d11748b3141400993fbbb688f383e1` | `e37eb9f8f1a8573605dba111c8d0a3deb27f1520346df11234fab9742651517a` |
| move-source-empty-after-visual-commit | `da494f30a8be1a018a620336fa64bc75348a238ed3ad0f3bcf3d564954f0906d` | `90b7e1d9bad37a8b6841428087567ecaf3fea4f8c159aa5f15475a910d2b570d` |
| pending-selection-reconcile-after-visual-commit | `58306bc965ab32c0e85c2f564ce4ea97d42605e60943a2229c30fe335c9a563f` | `279ccf975e4b4afad203085da2418e0c2f67191101ee474ed1cff67a42f41d0b` |

## Migration inventories

- Presentation source digest: `a9f584aacb8bf2fcc94a89b9d0cd3c782072d42b0bce6e803e0e4d0ab1dc2132`
- DOM selector dependency digest: `415b25a90ea9348731f0873a3c6fe5235458c581a3f7e60e641ffcb0fb0548d2`
- Files with selector dependencies: 88

## Reproduction

- `npm run baseline:pixijs-playfield`
- Existing visual-regression baselines outside `pixijs-playfield-dom/` are not overwritten.
- Timing values are machine-specific; compare only with the same browser, viewport, DPR, and machine.
