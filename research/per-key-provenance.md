# Per-key source provenance

Numeric key geometry and LED indices were extracted from the EPOMAKER F75 Max driver Beta 1.0.0.5 layouts/rgb-keyboard.xml. No vendor executable or artwork is redistributed.
Download: https://orders.epomaker.com/software/AULA_F75_Max_Gasket_Mechanical_Keyboard_Driver_1.0.0.5.zip
Layout SHA256: 9309c503ea77539f6918b5aaffc99e645e526926cc96efe95e55100e579916e8

Packet framing: https://github.com/thibaultmiclo/aula-driver/blob/main/aula/wireless.py
Table layout: https://github.com/thibaultmiclo/aula-driver/blob/main/aula/protocol.py
License: LICENSE.perkey (MIT).
Upstream wireless per-key commands were decoded for a related model but not hardware-tested. F75 Max wireless upload remains experimental. The official layout explicitly enables wireless user_light. Indices follow the vendor layout, including right Alt index 95, which may differ on some batches.

## Official sender inspection

Static inspection of the official DeviceDriver.exe (no vendor executable run):
- 0x44BE70 builds custom mode, indexed color table and 0x14 chunks.
- 0x44F5D0 checks the first three response bytes against command/length/sequence.
- 0x44C1A0 inserts a 2 ms pause after each acknowledged chunk.
The app now follows the ACK-based sender instead of blind 35 ms pacing.

## Session initialization confirmed on hardware

Official driver 0x44F770 initializes the receiver with command 02 and waits for
its response. Missing initialization caused the user's first custom-mode ACK to
be absent. Live interface-3 probe returned 02/00/00 after init, 05/10/00 after
custom mode, and matching 14/length/sequence replies for all 21 table chunks.
Interface 3 descriptor: 32-byte input/output. Interface 4: 64-byte input/output.
Acknowledgment completion is confirmed; visual color correctness is not claimed.

## Official capture comparison and physical confirmation (0.2.1)

The private capture's W-red table matches the app's indexed RGB layout byte for
byte. Its final transaction contains W/A/S/D at RGB 339933 and other keys off.
Replaying only the lighting packets on interface 3 was physically confirmed by
the user. The user subsequently confirmed the updated 0.2.1 editor's custom
colors match the keyboard. No capture bytes, keystrokes, or raw USB dumps are
published. The Rust suite uses a synthetic W-red regression vector.
