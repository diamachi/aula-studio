# F75 Max: investigating display uploads over 2.4 GHz

## Result

No usable wireless image/GIF transfer path was found in the connected receiver or the inspected official Windows driver. The existing display uploader cannot be moved to the receiver simply by changing its VID/PID or splitting its USB blocks into smaller packets.

This establishes a limitation of the known transport and vendor implementation. It does **not** prove that undocumented receiver/keyboard firmware contains no additional commands. Establishing that would require firmware analysis or a demonstrated wireless upload to capture.

## Evidence from this keyboard

Read-only HID enumeration on 2026-10-31 found the following vendor interfaces on the `05AC:024F` receiver:

| Interface (Windows) | Usage page | Input bytes | Output bytes | Feature reports |
| --- | --- | --- | --- | --- |
| 3 | FF60 | 32 | 32 | None declared |
| 4 | FF60 | 64 | 64 | None declared |

These are report payload sizes; HIDAPI write buffers add the zero report-ID byte. The descriptors declare byte-sized, unnumbered input/output reports. The other vendor collection, page FFFF, is input-only with report ID 5 and a three-byte payload.

In particular, the receiver has **a 64-byte interface as well as the 32-byte one**. A third-party statement that it only exposes 32-byte reports does not describe this unit completely. However, neither interface declares the wired screen's 4096-byte output reports or its feature-report command channel. The 64-byte interface alone is not evidence of display support.

The working wired `0C45:800A` keyboard separately exposes page FF13 (64-byte feature reports) and FF68 (4096-byte output / 64-byte input). Those endpoints were inspected before implementing the uploader, and the user confirmed the resulting display output.

## Evidence from the official driver

Inspected file: F75 Max driver 1.0.0.5, extracted `DeviceDriver.exe`, SHA-256 `4f7847d9fd1bd6b9db611fe3a4e7827111e45bf824a8ba4b40f0726137870855`. Addresses below are x86 virtual addresses in that binary. No vendor program was executed for this audit.

- `layouts/rgb-keyboard.xml` enables `screen` for the wired menu and sets it to zero for `menu_wireless`. Wireless per-key lighting is enabled separately.
- The image upload routine constructs wired commands `04 18`, `04 72`, and `04 02`. Its image-block loop calls `0044F2B0` at `00423023`. This is the only direct call to that pixel sender found in the inspected disassembly.
- `0044F2B0` obtains the display handle from object offset `+0x2c`, returns if absent, copies exactly `0x1000` image bytes into a `0x1001` report including report ID, then calls the raw sender at `00451210`.
- Device enumeration at `0044FA50` assigns that display handle only in the branch comparing the report size with `0x1001` (`0044FDBF`–`0044FDCC`). A 33-byte input/output pair is classified separately as a wireless device. A different branch recognizes the 65-byte command interface by its feature-report length.
- The 16 direct callers of wireless sender `0044F5D0` were examined. No image-block uploader calling that sender was found. The known RGB table sender is separate from the screen uploader.

Thus removing the menu restriction would expose a button whose known upload path still lacks a receiver display handle. It would not implement RF image transfer.

## Why smaller packets are insufficient

The wireless settings protocol supports command, payload length, sequence index, up to 28 payload bytes, checksum, and an echo acknowledgment. That proves a settings transport exists, not that it accepts arbitrary display memory writes. It needs a firmware-defined display command, addressing scheme, transfer boundaries and commit operation before it can carry image data. A single 128×128 RGB565 frame already needs more than 1,170 such payloads, exceeding the one-byte sequence index without a defined paging mechanism.

No unknown opcodes, flash writes, reset commands or firmware updates were sent. Reusing the RGB or macro commands for pixel data would target different configuration storage.

## What could change the conclusion

1. A successful wireless image upload by an official/newer driver, with a USB capture of the receiver traffic.
2. Receiver and keyboard firmware images that expose an RF display transfer handler.
3. A verified firmware modification implementing that handler on both sides, with a recovery path. This is separate firmware work, not a desktop-app transport change.

For the current app, retain wired uploads and the stored image/GIF for wireless playback. Wireless uploading remains unsupported rather than presenting an unverified success state.

## Related primary sources

- [VitalyArt driver connection matrix](https://github.com/VitalyArt/Aula-F75-Max-Driver#connect-your-keyboard): wired display uploads; wireless lighting/settings.
- [Independent vendor-driver audit](https://github.com/schiz0x00/keyboard-screen/blob/main/docs/wireless-re.md): matching pixel-sender and enumeration addresses. Its categorical impossibility conclusion is stronger than this audit claims, and its receiver report-size statement omits this unit's 64-byte interface.
- [Decoded wireless settings framing](https://github.com/thibaultmiclo/aula-driver/blob/main/aula/wireless.py): known settings commands, not an image uploader.
