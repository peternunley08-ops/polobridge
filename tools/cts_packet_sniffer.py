#!/usr/bin/env python3
"""
PoloBridge CTS Packet Sniffer & Protocol Verifier
Listens on a serial port (USB-to-RS232 adapter or ESP32 UART output)
Decodes Colorado Time Systems (CTS) 9600-8-E-1 binary scoreboard stream.

Usage:
    python3 cts_packet_sniffer.py --port /dev/tty.usbserial-110
    python3 cts_packet_sniffer.py --port COM3 (on Windows)
"""

import sys
import time
import argparse

try:
    import serial
except ImportError:
    print("Error: pyserial is required. Install with: pip install pyserial")
    sys.exit(1)

def parse_arguments():
    parser = argparse.ArgumentParser(description="Colorado Time Systems RS-232 Protocol Sniffer")
    parser.add_argument("--port", required=True, help="Serial port (e.g. /dev/tty.usbserial-xxx or COM3)")
    parser.add_argument("--baud", type=int, default=9600, help="Baud rate (default: 9600)")
    return parser.parse_args()

def decode_cts_stream(port, baud):
    print(f"\n=======================================================")
    print(f" Listening for CTS Packets on {port} @ {baud} 8-E-1")
    print(f"=======================================================\n")

    try:
        # CTS uses 8 Data Bits, EVEN Parity, 1 Stop Bit
        ser = serial.Serial(
            port=port,
            baudrate=baud,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_EVEN,
            stopbits=serial.STOPBITS_ONE,
            timeout=1.0
        )
    except serial.SerialException as e:
        print(f"Failed to open port {port}: {e}")
        return

    while True:
        try:
            byte = ser.read(1)
            if not byte:
                continue

            b = byte[0]
            # CTS Frame Header: Value > 127 (MSB = 1)
            if b >= 0x80:
                channel = (b >> 1) & 0x1F
                is_attr_frame = (b & 0x01) != 0

                payload = ser.read(8)
                if len(payload) < 8:
                    continue

                timestamp = time.strftime("%H:%M:%S")

                if not is_attr_frame:
                    # Character Data Frame
                    ascii_str = "".join(chr(c & 0x7F) for c in payload)
                    hex_str = " ".join(f"{c:02X}" for c in payload)

                    chan_name = {
                        0x00: "GAME CLOCK",
                        0x01: "SCORE/PERIOD",
                        0x05: "SHOT CLOCK"
                    }.get(channel, f"CH 0x{channel:02X}")

                    print(f"[{timestamp}] [CHAR] {chan_name:<14} | Text: '{ascii_str}' | Hex: {hex_str}")

                else:
                    # Attribute Data Frame (Colons, Decimals, Horn)
                    hex_str = " ".join(f"{c:02X}" for c in payload)
                    horn_active = any((c & 0x40) != 0 for c in payload)
                    horn_str = "🚨 [HORN ON]" if horn_active else ""
                    print(f"[{timestamp}] [ATTR] Channel 0x{channel:02X}     | Attr: {hex_str} {horn_str}")

        except KeyboardInterrupt:
            print("\nExiting sniffer...")
            break
        except Exception as e:
            print(f"Error reading stream: {e}")
            break

    ser.close()

if __name__ == "__main__":
    args = parse_arguments()
    decode_cts_stream(args.port, args.baud)
