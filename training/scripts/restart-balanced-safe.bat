@echo off
REM Restart balanced training from iteration 2 with single-threaded self-play
REM to avoid the 'player is not defined' race condition.

cd /d "C:\Users\quarr\Desktop\othello_v2"

echo [restart] Restarting balanced training with --selfplay-jobs 1...

node scripts\run-selfplay-training-cycle.js ^
    --run-name browser_lv6_growth_v1_20260426_cnn_v1_balanced ^
    --restart-from-step generate-train ^
    --reuse-existing-artifacts ^
    --selfplay-jobs 1 ^
    --adoption-jobs 1 ^
    --games 4000 ^
    --seed 1001 ^
    --max-plies 180 ^
    --card-usage-rate 0.1 ^
    --tactical-depth-opening 4 ^
    --tactical-depth-mid 5 ^
    --tactical-depth-end 6 ^
    --tactical-beam-width 6 ^
    --policy-mix-rate 0.75 ^
    --policy-pool-recency-decay 1.8 ^
    --epochs 50 ^
    --batch-size 256 ^
    --lr 0.001 ^
    --hidden-channels 32 ^
    --num-res-blocks 3 ^
    --out-dir data\runs\browser_lv6_growth_v1 ^
    --models-dir data\models\browser_lv6_growth_v1

echo [restart] Done.
pause
