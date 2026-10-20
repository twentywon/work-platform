# User delivery requirements

- The user wants the HTML application to remain easy to update. Do not build EXE artifacts unless explicitly requested again.
- For each user-facing app update, run `npm run package:html` and prepare the resulting versioned ZIP. Include the standalone HTML, Korean usage instructions, and editable project sources. Do not include node_modules, caches, desktop binaries, or browser profiles.
- The user explicitly requests downloadable ZIP delivery every time. Use an actual attachment/export capability when available. A file existing under /workspace does not establish download access. Never describe an internal path as a working download link unless delivery has been confirmed. If attachment is unavailable, state that ZIP creation succeeded but downloadable delivery remains blocked.
- File cards are intended as shortcuts to the user's original PC files. Clearly explain that pure HTML cannot reliably launch Windows default applications; do not silently describe browser previews as native original-file opening.
