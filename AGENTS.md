# WildHatch browser verification

After changing the title screen, wallet entry, guest flow, or field HUD, run `npm run test:kane` with the app running. Use `.testmuai/wildhatch/latest.json` for the file-level verdict and evidence paths. When a run exposes a product bug, fix the cause and rerun the same test before reporting the result. Distinguish a browser or authentication setup error from a failed product assertion.

The test uses Guest Mode in a real browser. Keep wallet keys, database credentials, and TestMu credentials out of test objectives and evidence. Record changes to the expected user experience in `tests/kane/guest_expedition_test.md`.
