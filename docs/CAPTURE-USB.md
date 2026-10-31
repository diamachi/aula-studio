# Record the official app's custom-lighting commands

Capture on **Windows**, with the keyboard in **2.4G** mode and its USB receiver
connected. We need the PC-to-receiver USB traffic, not a radio or Wi-Fi capture.

## Install and select the capture interface

1. Install [Wireshark](https://www.wireshark.org/download.html) and its optional
   **USBPcap** component. If USBPcap is absent, install it from the
   [official USBPcap releases](https://github.com/desowin/usbpcap/releases).
   Restart Windows if requested.
2. Close **all AULA Studio builds** and the official AULA app.
3. Open Wireshark. USB capture interfaces should appear as `USBPcap1`,
   `USBPcap2`, etc. Use their capture-options/gear button and the attached-device
   list to find the root hub containing **2.4G Dongle**, VID `05AC`, PID `024F`.
   USBPcapCMD's device list can also identify the correct hub.
4. Select that USBPcap interface. If supported in its options, select only the
   receiver and enable capturing newly connected devices.
5. Start recording **before** opening the official app. Unplug/replug the
   receiver into the same USB port after recording starts, so the capture
   includes its descriptors and session initialization.

Wireshark's [USB setup guide](https://wiki.wireshark.org/CaptureSetup/USB) and
USBPcap's [extcap instructions](https://desowin.org/usbpcap/tour.html) explain
the capture interface and device selection. This is a USBPcap capture, not
an Ethernet/Wi-Fi capture; Npcap alone does not provide USB capture.

## Make a small, controlled recording

Prepare a note file with the exact steps and approximate times. Do not type
passwords or personal text while capturing: USB traffic can include keystrokes
and other devices on the same hub. Keep captures private until reviewed.

Record this sequence, waiting about 2 seconds between actions:

1. Launch the official AULA app and wait until it detects the receiver.
2. Set ordinary **Static** mode to `#202020`, brightness 3. Apply.
3. Open **User Lighting / Custom Lighting** (its name may vary).
4. Set all keys to `#202020`. Apply and note whether it visibly works.
5. Change **only W** to red `#FF0000`. Apply and note whether W turns red.
6. Change **only W** to blue `#0000FF`. Apply and note the result.
7. Change **W, A, S, D** to green `#00FF00`. Apply and note the result.
8. Stop Wireshark recording immediately. Save the capture as
   `f75max-wireless-custom.pcapng`.

If the official app cannot change individual colors over 2.4G, stop and note
that fact. You can make a **separate** recording in USB wired mode, saved as
`f75max-wired-custom.pcapng`. Do not mix wired and wireless tests in one file.
The wired device is `0C45:800A`; a wired capture alone does not demonstrate
support over the wireless receiver.

## Save the useful packets

Keep the original capture private. To make a smaller shareable file:

1. Find the receiver's enumeration packets. The vendor/product IDs identify
   the receiver at enumeration; later transfers use a USB device address.
2. Right-click its **USB device address** field and choose **Apply as Filter →
   Selected**. If the hub has multiple buses, combine it with that packet's
   USB bus ID. The device address may change after reconnecting.
3. Keep **all endpoints and both directions** for the receiver. Do not filter
   to only output data or only `usb.capdata`: initialization, control transfers,
   acknowledgments, descriptors, and timing all matter.
4. Use **File → Export Specified Packets**, select **Displayed**, and save as
   `f75max-wireless-custom-filtered.pcapng`. Check that it includes the receiver
   enumeration plus the lighting actions. If addresses changed, include both.

Please provide the filtered `.pcapng` and your note file privately in this chat.
Include the official app version, keyboard layout (ANSI/ISO), connection mode,
and which changes physically worked. A short screen recording of the official
app is useful as a supplement, but it cannot replace the packet capture.

Do not post raw capture files in a public GitHub issue. The source repository
ignores capture formats and `captures/` by default.
