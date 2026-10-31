# F75 Max wired mini display

The implementation follows the MIT-licensed [VitalyArt F75 Max driver](https://github.com/VitalyArt/Aula-F75-Max-Driver), specifically `AulaDevice.swift` and `DisplayEncoder.swift`. The upstream license is retained in `LICENSE.upstream`. The official F75 Max 1.0.0.5 layout independently specifies 128×128 pixels, a 256-byte header, 255 frames and one custom slot.

On 2026-10-31 the connected Windows keyboard exposed VID/PID `0C45:800A`, page `FF13` with 64-byte feature reports, and page `FF68` with 4096-byte output and 64-byte input reports. The complete clock exchange returned the expected command-ready replies and time-payload echo. The user subsequently confirmed that the uploaded image/GIF appeared correctly on the physical keyboard display using the 0.3.0 Windows test build. macOS hardware testing remains outstanding.

Image stream: byte 0 frame count, bytes 1 onward frame delays in 2 ms ticks (1–255), image data beginning at offset 256. Each frame is 128×128 RGB565 little endian. Pad the complete stream to a multiple of 4096 bytes.

Upload: feature `04 18`, feature `04 72` (slot at byte 2, block count little endian at bytes 8–9), 4096-byte raw output blocks with fresh raw input pacing, feature `04 02`. HIDAPI buffers include leading zero report IDs. Stop on missing acknowledgments; do not blindly retransmit image blocks.

Clock: `04 18`, `04 28` with byte 8 set to 1, data `00 01 5A YY MM DD hh mm ss 00 weekday` with `AA 55` at bytes 62–63, `04 02`. Weekday is Sunday=0. Command replies echo the first two bytes and set byte 3 to 1. Data replies echo the payload.

No wireless TFT command mapping is inferred, and no reset, memory-clear or firmware-update commands are used.

See [wireless display audit](wireless-display-audit.md) for the receiver descriptors, official driver trace, and remaining limits of the 2.4 GHz investigation.
