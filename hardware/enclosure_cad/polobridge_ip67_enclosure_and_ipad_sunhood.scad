// ============================================================================
// PoloBridge Rev 2.5 — Parametric OpenSCAD 3D-Printable Hardware Pack
// Contains two field-ready parts for high school & collegiate water polo decks:
//   Part 1: Hammond 1554C2GYCL Drill Jig & 3-Button Emergency Fail-Safe Lid Guard
//   Part 2: PoloPad Pro 25-Degree Anti-Glare Poolside iPad Sun-Hood & Stand
// Units: Millimeters (mm)
// ============================================================================

$fn = 64;

// --- Parameters: Hammond 1554C2GYCL IP67 Enclosure (120 x 65 x 40 mm) ---
enclosure_len = 120.0;
enclosure_wid = 65.0;
wall_thick    = 3.0;

// Neutrik NRJ6HM-1 1/4" Jack Panel Cutouts (11.2mm diameter, 28mm spacing)
jack_hole_dia = 11.4;
jack_spacing  = 28.0;

// 3 Waterproof Emergency Lid Buttons (Start/Stop, 30s, 20s) + 105dB Piezo Port
btn_hole_dia  = 12.2;
piezo_dia     = 22.0;

// --- Part 1: Snap-On End-Panel Drill Jig & Lid Button Guard ---
module polobridge_drill_jig_and_lid_plate() {
    difference() {
        union() {
            // Top lid bezel with raised guard rings around Emergency Buttons
            cube([enclosure_len, enclosure_wid, wall_thick], center=false);
            // Right-side end-cap drill guide for 2x Neutrik 1/4" Jacks
            translate([enclosure_len - wall_thick, 0, -32])
                cube([wall_thick, enclosure_wid, 35], center=false);
            // Protective raised collars around the 3 Emergency Fail-Safe Buttons
            for (i = [0:2]) {
                translate([58 + i*16, 20, wall_thick])
                    cylinder(h=4.0, d=btn_hole_dia + 4.0);
            }
        }
        // 3 Emergency Button Through-Holes (SW3=Start/Stop, SW4=30s, SW5=20s)
        for (i = [0:2]) {
            translate([58 + i*16, 20, -1])
                cylinder(h=10.0, d=btn_hole_dia);
        }
        // 105dB Waterproof Marine Piezo Acoustic Port (GPIO 7 / Q1)
        translate([28, 32.5, -1])
            cylinder(h=10.0, d=piezo_dia);

        // 2x Neutrik NRJ6HM-1 1/4" Jack Drill Guide Holes (RS-232 Out + 3-Ch Pickle Out)
        translate([enclosure_len - wall_thick - 1, enclosure_wid/2 - jack_spacing/2, -16])
            rotate([0, 90, 0])
                cylinder(h=wall_thick + 4, d=jack_hole_dia);
        translate([enclosure_len - wall_thick - 1, enclosure_wid/2 + jack_spacing/2, -16])
            rotate([0, 90, 0])
                cylinder(h=wall_thick + 4, d=jack_hole_dia);
    }
}

// --- Part 2: 25-Degree Anti-Glare Poolside iPad Sun-Hood & Weighted Stand ---
module polopad_ipad_sunhood_stand(ipad_width = 255.0, hood_depth = 95.0) {
    difference() {
        // Outer sun-hood shell & 25-degree angled base
        cube([ipad_width + 12, hood_depth, 175], center=false);
        // Inner viewing tunnel
        translate([6, -2, 12])
            cube([ipad_width, hood_depth + 4, 157], center=false);
        // Angled front visor cut for referee & scorer sightline
        translate([-2, 0, 165])
            rotate([-22, 0, 0])
                cube([ipad_width + 16, hood_depth + 20, 40], center=false);
    }
}

// Render Part 1 at origin and Part 2 offset in Y
polobridge_drill_jig_and_lid_plate();
translate([0, 90, 0]) polopad_ipad_sunhood_stand();
