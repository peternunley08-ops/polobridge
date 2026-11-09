#!/usr/bin/env python3
"""
PoloBridge Rev 2.5 — Deterministic ASCII STL Mesh Generator
Generates ready-to-slice 3D printable .STL meshes:
  1. hardware/enclosure_cad/polobridge_front_panel_drill_jig.stl
  2. hardware/enclosure_cad/polopad_poolside_sunhood_stand.stl
"""

import os
from typing import List, Tuple

Vec3 = Tuple[float, float, float]
Tri = Tuple[Vec3, Vec3, Vec3]


def box_triangles(x0: float, y0: float, z0: float, x1: float, y1: float, z1: float) -> List[Tri]:
    v000 = (x0, y0, z0)
    v100 = (x1, y0, z0)
    v110 = (x1, y1, z0)
    v010 = (x0, y1, z0)
    v001 = (x0, y0, z1)
    v101 = (x1, y0, z1)
    v111 = (x1, y1, z1)
    v011 = (x0, y1, z1)
    return [
        (v000, v110, v100), (v000, v010, v110),  # Bottom
        (v001, v101, v111), (v001, v111, v011),  # Top
        (v000, v100, v101), (v000, v101, v001),  # Front
        (v010, v011, v111), (v010, v111, v110),  # Back
        (v000, v001, v011), (v000, v011, v010),  # Left
        (v100, v110, v111), (v100, v111, v101),  # Right
    ]


def write_ascii_stl(filepath: str, solid_name: str, tris: List[Tri]) -> None:
    lines = [f"solid {solid_name}"]
    for v1, v2, v3 in tris:
        lines.append("  facet normal 0.0 0.0 1.0")
        lines.append("    outer loop")
        lines.append(f"      vertex {v1[0]:.3f} {v1[1]:.3f} {v1[2]:.3f}")
        lines.append(f"      vertex {v2[0]:.3f} {v2[1]:.3f} {v2[2]:.3f}")
        lines.append(f"      vertex {v3[0]:.3f} {v3[1]:.3f} {v3[2]:.3f}")
        lines.append("    endloop")
        lines.append("  endfacet")
    lines.append(f"endsolid {solid_name}\n")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main() -> None:
    out_dir = os.path.dirname(os.path.abspath(__file__))

    # 1. Hammond 1554C2GYCL Snap-On Drill Jig & 3-Button Emergency Lid Guard (120x65mm)
    jig_tris: List[Tri] = []
    jig_tris.extend(box_triangles(0, 0, 0, 120, 65, 3))          # Top Lid Plate
    jig_tris.extend(box_triangles(117, 0, -32, 120, 65, 0))      # Right 1/4" Jack Drill Wall
    jig_tris.extend(box_triangles(52, 14, 3, 96, 26, 7))         # Raised Guard Rail for 3 Emergency Lid Buttons
    jig_path = os.path.join(out_dir, "polobridge_front_panel_drill_jig.stl")
    write_ascii_stl(jig_path, "polobridge_front_panel_drill_jig", jig_tris)

    # 2. PoloPad Pro 25-Degree Anti-Glare Poolside iPad Sun-Hood & Stand (267x95x175mm)
    hood_tris: List[Tri] = []
    hood_tris.extend(box_triangles(0, 0, 0, 267, 95, 12))        # Weighted Non-Slip Base
    hood_tris.extend(box_triangles(0, 0, 12, 6, 95, 175))        # Left Glare Shield Wing
    hood_tris.extend(box_triangles(261, 0, 12, 267, 95, 175))    # Right Glare Shield Wing
    hood_tris.extend(box_triangles(0, 0, 169, 267, 95, 175))     # Top Overhead Sun Visor
    hood_path = os.path.join(out_dir, "polopad_poolside_sunhood_stand.stl")
    write_ascii_stl(hood_path, "polopad_poolside_sunhood_stand", hood_tris)

    print(f"Generated {jig_path} ({os.path.getsize(jig_path)} bytes)")
    print(f"Generated {hood_path} ({os.path.getsize(hood_path)} bytes)")


if __name__ == "__main__":
    main()
