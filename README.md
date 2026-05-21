# PixelCrypt – Visual Cryptography & Pixel Manipulation

PixelCrypt is a cutting‑edge, client‑side visual cryptography workbench that lets you encrypt, decrypt, and explore images at the pixel level in real time. Built with HTML5 Canvas, a glass‑morphic CSS design, and modern ES6 JavaScript, the app runs fully in the browser with **zero server dependencies**, guaranteeing privacy and instant feedback.

## Features

- **Multiple pixel‑level ciphers** – XOR stream, block shuffling, modular additive (Caesar), RGB channel permutation.
- **Interactive zoom HUD** – Hover‑inspect any pixel with a 9 × 9 magnifier showing RGB values, hex, binary, and live progress bars.
- **Demo patterns** – Load a futuristic demo image to see the effects instantly.
- **Premium UI** – Cyber‑punk glassmorphism, neon accents, animated background orbs, and responsive layout.
- **Light / Dark theme toggle** – A sleek button in the header switches between a deep‑space dark mode and a clean, high‑contrast light mode, persisting your choice via `localStorage`.

## Usage

1. Open `index.html` in a modern browser.
2. Drag‑and‑drop or select an image (PNG recommended).
3. Choose an algorithm, enter a passphrase (or generate one), and click **Encrypt**.
4. Switch to the **Decrypted** view to verify the original image is restored.
5. Toggle the theme button (sun/moon icon) to change the UI appearance.

## Development

- **Core files**: `index.html`, `style.css`, `script.js`.
- **Theme implementation** – CSS custom properties under the `.light-theme` class and a toggle button (`#theme-toggle`) wired in `script.js`.
- To extend the app, add new cipher functions in `script.js` and update the UI options in `index.html`.

---

Enjoy experimenting with pixel‑level cryptography and the polished UI! 🎨🔐
