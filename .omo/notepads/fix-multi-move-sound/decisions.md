# Decisions - fix-multi-move-sound

- ROBOT_VACUUM は `hyperactive_move` 効果音を使用（既存の hyperactive 系カードと同様）
- WILL_HUNTER_KING は `ultimate_anchor_move` 効果音を使用（究極反転龍・究極破壊神と同様）
- フォールバックパスにも robot_vacuum/will_hunter_king の raw event 判定を追加（一貫性のため）
- 既存の DESTROY_EVADE パスは変更しない
