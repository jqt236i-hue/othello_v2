@echo off
REM Phase 1 Integration Test: End-to-end training pipeline smoke test
REM Uses first 1000 records from existing self-play data for quick validation

cd /d "C:\Users\quarr\Desktop\othello_v2"

set FULL_DATA=data\runs\browser_lv6_growth_v1\selfplay.train.browser_lv6_growth_v1_20260426_cnn_v1_light.it02.ndjson
set TEST_DATA=data\runs\browser_lv6_growth_v1\test-selfplay-1k.ndjson
set OUT_PREFIX=data\models\browser_lv6_growth_v1\policy-cnn-v2-integration-test

if not exist "%FULL_DATA%" (
    echo [integration-test] ERROR: Full data not found: %FULL_DATA%
    exit /b 1
)

echo [integration-test] Extracting first 1000 records for test...
powershell -Command "Get-Content '%FULL_DATA%' -TotalCount 1000 | Set-Content '%TEST_DATA%'"
if %errorlevel% neq 0 (
    echo [integration-test] ERROR: Failed to extract test data
    exit /b 1
)

echo [integration-test] Running integration test training...
python ai\train\train_policy_onnx_v2.py ^
    --input "%TEST_DATA%" ^
    --onnx-out "%OUT_PREFIX%.onnx" ^
    --meta-out "%OUT_PREFIX%.json" ^
    --metrics-out "%OUT_PREFIX%.metrics.json" ^
    --epochs 2 ^
    --batch-size 64 ^
    --lr 0.001 ^
    --hidden-channels 32 ^
    --num-res-blocks 3 ^
    --val-split 0.1 ^
    --card-loss-weight 2.0 ^
    --card-no-action-weight 0.7 ^
    --value-loss-weight 1.0 ^
    --nonvalidity-penalty 0.5 ^
    --winner-sample-boost 0.35 ^
    --loser-sample-weight 0.8 ^
    --seed 42 ^
    --log-interval-steps 10 ^
    --device cpu

if %errorlevel% equ 0 (
    echo [integration-test] SUCCESS: Training completed without errors
    echo [integration-test] Output model: %OUT_PREFIX%.onnx
    echo [integration-test] Output meta: %OUT_PREFIX%.json
) else (
    echo [integration-test] FAILED: Training exited with error code %errorlevel%
    exit /b 1
)

REM Cleanup test data
if exist "%TEST_DATA%" del "%TEST_DATA%"

echo [integration-test] Done.
pause
