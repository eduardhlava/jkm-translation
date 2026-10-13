# Tasks
- [ ] Add table-cell B/I/U shortcuts and rich-content round trips; verify saved reload, Notion and PDF, then restore the test document.
- [x] Separate document page name from printed heading in metadata; verified real rename, unchanged printed metadata, empty-name validation and failed-write rollback in the authenticated preview; restored the original Notion title.
- [x] Toolbar icons: clipboard-with-T for „Vložit bez formátování“, highlighter pen with color strip for background color, tooltips on all three; verified in the authenticated preview.
- [x] Add inline formatting removal and compact text background selector; verified index toggles, all four colors, saved content read-back and normal text in downloaded PDF in the authenticated preview; restored original document.
- [x] Increase spacing above PDF headings.
- [x] Add Horizontální mezera with JSON/Notion marker round-trip support (three tests passed).
- [x] Constrain pictogram cell text in editor and PDF.
- [x] Render the electrical-danger lightning symbol in PDF.
- [x] Verify adding a spacer and generating/downloading PDF in the authenticated editor; visually inspect all four PDF pages. Table overflow and wrong electrical symbol are corrected; no additional PDF layout issues found.