# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Workflow: no auto-verification on the emulator

After making a code change, just edit the code (and run `tsc --noEmit` if useful). Do **not** automatically:
- restart/reboot the emulator
- run `adb`, screenshot, or reload the app
- start/stop Metro

Only do those things when the user explicitly asks for it (e.g. "check on emulator", "restart the device", "run it"). This burns a lot of tokens per turn and the user would rather spend them on code. Default to code-only changes and a short text summary of what changed.
