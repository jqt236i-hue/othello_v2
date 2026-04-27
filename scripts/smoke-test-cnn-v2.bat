@echo off
REM Quick smoke-test training for CNN v2 model (WDL + Hand Encoder)
REM Uses existing self-play data from cnn_v1_light iteration 02

cd /d "C:\Users\quarr\Desktop\othello_v2"

set DATA_FILE=data\runs\browser_lv6_growth_v1\selfplay.train.browser_lv6_growth_v1_20260426_cnn_v1_light.it02.ndjson
set OUT_PREFIX=data\models\browser_lv6_growth_v1\policy-cnn-v2-smoke

if not exist "%DATA_FILE%" (
    echo ERROR: Self-play data not found: %DATA_FILE%
    exit /b 1
)

echo [smoke-test] Starting v2 model smoke test training...
echo [smoke-test] Input: %DATA_FILE%
echo [smoke-test] Output prefix: %OUT_PREFIX%

python ai\train\train_policy_onnx_v2.py ^
    --input "%DATA_FILE%" ^
    --onnx-out "%OUT_PREFIX%.onnx" ^
    --meta-out "%OUT_PREFIX%.json" ^
    --metrics-out "%OUT_PREFIX%.metrics.json" ^
    --epochs 3 ^
    --batch-size 128 ^
    --lr 0.001 ^
    --hidden-channels 32 ^
    --num-res-blocks 3 ^
    --val-split 0.05 ^
    --card-loss-weight 2.0 ^
    --card-no-action-weight 0.7 ^
    --value-loss-weight 1.0 ^
    --nonvalidity-penalty 0.5 ^
    --winner-sample-boost 0.35 ^
    --loser-sample-weight 0.8 ^
    --seed 42 ^
    --log-interval-steps 50 ^
    --device cpu

echo [smoke-test] Done.
pause
