from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.db.models import SubjectBranch


LEFT_OFFSETS = [(-105.0, -85.0), (5.0, -155.0), (135.0, -95.0)]
RIGHT_OFFSETS = [(-90.0, -85.0), (22.0, -165.0), (145.0, -92.0)]
CENTER_OFFSETS = [(-95.0, -120.0), (0.0, -185.0), (118.0, -122.0)]

LEFT_ROW_PUSH_X = [-38.0, 10.0, 72.0]
RIGHT_ROW_PUSH_X = [-72.0, -10.0, 38.0]
CENTER_ROW_PUSH_X = [-50.0, 0.0, 50.0]
ROW_PUSH_Y = [90.0, 104.0, 92.0]


def compute_leaf_position(branch: SubjectBranch, unlock_order: int) -> tuple[float, float]:
    row = unlock_order // 3
    col = unlock_order % 3

    if branch.anchor_x < -100:
        base_offsets = LEFT_OFFSETS
        row_push_x = LEFT_ROW_PUSH_X
    elif branch.anchor_x > 100:
        base_offsets = RIGHT_OFFSETS
        row_push_x = RIGHT_ROW_PUSH_X
    else:
        base_offsets = CENTER_OFFSETS
        row_push_x = CENTER_ROW_PUSH_X

    base_x, base_y = base_offsets[col]
    spread = 1.0 + branch.grade_level.sort_order * 0.04
    offset_x = base_x + row * row_push_x[col]
    offset_y = base_y - row * ROW_PUSH_Y[col]

    return branch.anchor_x + offset_x * spread, branch.anchor_y + offset_y * spread


def slugify_token(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.strip().lower().replace("&", " and "))
    return cleaned.strip("-")
