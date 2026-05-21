/**
 * PIXELCRYPT - CRYPTOGRAPHIC ENGINE & INTERACTIVE CONTROLLER
 * Full client-side pixel manipulation sandbox.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadPrompt = document.getElementById('upload-prompt');
    const uploadPreviewContainer = document.getElementById('upload-preview-container');
    const previewThumbnail = document.getElementById('preview-thumbnail');
    const previewFileName = document.getElementById('preview-file-name');
    const previewFileMeta = document.getElementById('preview-file-meta');
    const btnRemoveImage = document.getElementById('btn-remove-image');
    const btnLoadDemo = document.getElementById('btn-load-demo');
    
    const algoSelect = document.getElementById('algorithm-select');
    const algoDesc = document.getElementById('algo-desc');
    const cryptoKey = document.getElementById('crypto-key');
    const btnGenerateKey = document.getElementById('btn-generate-key');
    const keyStrengthIndicator = document.querySelector('#key-strength-indicator .strength-bar');
    const keyStrengthText = document.querySelector('#key-strength-indicator .strength-text');
    
    const btnEncrypt = document.getElementById('btn-encrypt');
    const btnDecrypt = document.getElementById('btn-decrypt');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const canvasOriginal = document.getElementById('canvas-original');
    const canvasEncrypted = document.getElementById('canvas-encrypted');
    const canvasDecrypted = document.getElementById('canvas-decrypted');
    const canvasFocused = document.getElementById('canvas-focused');
    const viewportFocusSelect = document.getElementById('viewport-focus-select');
    
    const origDim = document.getElementById('orig-dim');
    const encDim = document.getElementById('enc-dim');
    const decDim = document.getElementById('dec-dim');
    
    const placeholderOrig = document.getElementById('placeholder-orig');
    const placeholderEnc = document.getElementById('placeholder-enc');
    const placeholderDec = document.getElementById('placeholder-dec');
    const singleCanvasPlaceholder = document.getElementById('single-canvas-placeholder');
    
    const downloadEncrypted = document.getElementById('download-encrypted');
    const downloadDecrypted = document.getElementById('download-decrypted');
    
    // Inspector HUD Elements
    const inspectorCoords = document.getElementById('inspector-coords');
    const magnifierGrid = document.getElementById('magnifier-grid');
    const valR = document.getElementById('val-r');
    const valG = document.getElementById('val-g');
    const valB = document.getElementById('val-b');
    const valHex = document.getElementById('val-hex');
    const binR = document.getElementById('bin-r');
    const binG = document.getElementById('bin-g');
    const binB = document.getElementById('bin-b');
    const barR = document.getElementById('bar-r');
    const barG = document.getElementById('bar-g');
    const barB = document.getElementById('bar-b');
    const colorPreview = document.getElementById('color-preview');
    
    // Processing Overlay
    const processingOverlay = document.getElementById('processing-overlay');
    const loaderTitle = document.getElementById('loader-title');
    const loaderStatus = document.getElementById('loader-status');
    const loaderProgressFill = document.getElementById('loader-progress-fill');

    // --- State Variables ---
    let sourceImage = null; // HTMLImageElement
    let isEncrypted = false;
    let isDecrypted = false;
    
    // Save image buffers for easy analysis
    let originalImageData = null;
    let encryptedImageData = null;
    let decryptedImageData = null;

    // --- ALGORITHM DESCRIPTIONS ---
    const ALGO_INFOS = {
        'xor-stream': 'Uses a key-seeded stream generator to XOR every red, green, and blue color value. Perfect visual scrambling that is highly secure and fully reversible.',
        'pixel-shuffle': 'Divides the image into blocks and shuffles their positions using a key-based Fisher-Yates shuffle. Reconstructs perfectly with the exact same seed.',
        'caesar-math': 'Applies modular arithmetic (addition/subtraction of key values) to every pixel color channel modulo 256. Creates a distinct scrambled gradient.',
        'channel-swap': 'Permutes the R, G, B channel ordering (e.g. Red becomes Blue, etc.) on a per-pixel basis using a key-seeded sequence. Creates vibrant, pseudo-colored images.'
    };

    algoSelect.addEventListener('change', () => {
        algoDesc.textContent = ALGO_INFOS[algoSelect.value] || '';
    });

    // --- SEEDABLE PRNG (Mulberry32 & Cyrb128) ---
    // Hashes string into a 32-bit state seed array
    function cyrb128(str) {
        let h1 = 1779033703, h2 = 3024733165, h3 = 3362453659, h4 = 50249228;
        for (let i = 0, k; i < str.length; i++) {
            k = str.charCodeAt(i);
            h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
            h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
            h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
            h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
        }
        h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
        h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
        h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
        h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
        return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
    }

    // Seeded Random Generator
    function mulberry32(a) {
        return function() {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
    }

    // --- KEY STRENGTH CHECKER ---
    function checkKeyStrength(key) {
        if (!key) {
            keyStrengthIndicator.className = 'strength-bar';
            keyStrengthText.textContent = 'No Key';
            return;
        }
        
        let score = 0;
        if (key.length >= 6) score += 1;
        if (key.length >= 10) score += 1;
        if (/[A-Z]/.test(key)) score += 1;
        if (/[0-9]/.test(key)) score += 1;
        if (/[^A-Za-z0-9]/.test(key)) score += 1;

        keyStrengthIndicator.className = 'strength-bar';
        if (score <= 2) {
            keyStrengthIndicator.classList.add('weak');
            keyStrengthText.textContent = 'Weak Key';
        } else if (score <= 4) {
            keyStrengthIndicator.classList.add('medium');
            keyStrengthText.textContent = 'Medium Key';
        } else {
            keyStrengthIndicator.classList.add('strong');
            keyStrengthText.textContent = 'Strong Key';
        }
    }

    cryptoKey.addEventListener('input', () => {
        checkKeyStrength(cryptoKey.value);
    });
    checkKeyStrength(cryptoKey.value);

    // Key Generator
    btnGenerateKey.addEventListener('click', () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
        let key = '';
        for (let i = 0; i < 16; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        cryptoKey.value = key;
        checkKeyStrength(key);
    });

    // --- IMAGE LOADING ROUTINES ---
    // Handle File Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            loadImageFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            loadImageFile(fileInput.files[0]);
        }
    });

    btnRemoveImage.addEventListener('click', (e) => {
        e.stopPropagation();
        resetImageState();
    });

    function resetImageState() {
        sourceImage = null;
        isEncrypted = false;
        isDecrypted = false;
        originalImageData = null;
        encryptedImageData = null;
        decryptedImageData = null;
        
        fileInput.value = '';
        uploadPreviewContainer.classList.add('hidden');
        uploadPrompt.classList.remove('hidden');
        
        canvasOriginal.classList.add('hidden');
        canvasEncrypted.classList.add('hidden');
        canvasDecrypted.classList.add('hidden');
        canvasFocused.classList.add('hidden');
        
        placeholderOrig.classList.remove('hidden');
        placeholderEnc.classList.remove('hidden');
        placeholderDec.classList.remove('hidden');
        singleCanvasPlaceholder.classList.remove('hidden');
        
        placeholderEnc.querySelector('p').textContent = 'Awaiting Encryption';
        placeholderDec.querySelector('p').textContent = 'Awaiting Decryption';
        
        origDim.textContent = '-';
        encDim.textContent = '-';
        decDim.textContent = '-';
        
        downloadEncrypted.disabled = true;
        downloadDecrypted.disabled = true;
        btnDecrypt.disabled = true;
    }

    function loadImageFile(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                setupOriginalImage(img, file.name, file.size);
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }

    function setupOriginalImage(img, filename, bytesize) {
        sourceImage = img;
        
        // Show metadata in upload preview
        previewThumbnail.src = img.src;
        previewFileName.textContent = filename;
        
        let sizeText = '';
        if (bytesize < 1024 * 1024) {
            sizeText = (bytesize / 1024).toFixed(1) + ' KB';
        } else {
            sizeText = (bytesize / (1024 * 1024)).toFixed(2) + ' MB';
        }
        previewFileMeta.textContent = `${img.width} × ${img.height} • ${sizeText}`;
        
        uploadPrompt.classList.add('hidden');
        uploadPreviewContainer.classList.remove('hidden');
        
        // Draw to original canvas
        canvasOriginal.width = img.width;
        canvasOriginal.height = img.height;
        const ctx = canvasOriginal.getContext('2d');
        ctx.drawImage(img, 0, 0);
        originalImageData = ctx.getImageData(0, 0, img.width, img.height);
        
        origDim.textContent = `${img.width} × ${img.height}`;
        canvasOriginal.classList.remove('hidden');
        placeholderOrig.classList.add('hidden');
        
        // Clear outputs
        canvasEncrypted.classList.add('hidden');
        placeholderEnc.classList.remove('hidden');
        canvasDecrypted.classList.add('hidden');
        placeholderDec.classList.remove('hidden');
        
        isEncrypted = false;
        isDecrypted = false;
        btnDecrypt.disabled = true;
        downloadEncrypted.disabled = true;
        downloadDecrypted.disabled = true;
        
        updateFocusedViewport();
    }

    // Load Demo Pattern
    btnLoadDemo.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        
        generateDemoPattern(canvas);
        
        const img = new Image();
        img.onload = function() {
            setupOriginalImage(img, "futuristic_demo_pattern.png", 328000);
        }
        img.src = canvas.toDataURL('image/png');
    });

    function generateDemoPattern(canvas) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // 1. Draw glowing visual gradient plasma
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                const cx = x - width / 2;
                const cy = y - height / 2;
                const dist = Math.sqrt(cx*cx + cy*cy);
                
                const val1 = Math.sin(dist / 22.0);
                const val2 = Math.sin(x / 15.0 + y / 30.0);
                const val3 = Math.cos(cx / 30.0) * Math.sin(cy / 30.0);
                
                const r = Math.floor((val1 + 1.0) * 127.5);
                const g = Math.floor((val2 + 1.0) * 127.5);
                const b = Math.floor((val3 + 1.0) * 127.5);
                
                data[idx] = r;
                data[idx+1] = g;
                data[idx+2] = b;
                data[idx+3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // 2. High tech HUD details overlay
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.45)';
        ctx.lineWidth = 3;
        ctx.strokeRect(40, 40, width - 80, height - 80);
        
        // Dash lines corners
        ctx.strokeStyle = '#7f00ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(30, 80); ctx.lineTo(30, 30); ctx.lineTo(80, 30);
        // Top-right
        ctx.moveTo(width-30, 80); ctx.lineTo(width-30, 30); ctx.lineTo(width-80, 30);
        // Bottom-left
        ctx.moveTo(30, height-80); ctx.lineTo(30, height-30); ctx.lineTo(80, height-30);
        // Bottom-right
        ctx.moveTo(width-30, height-80); ctx.lineTo(width-30, height-30); ctx.lineTo(width-80, height-30);
        ctx.stroke();

        // Rings
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
        ctx.beginPath();
        ctx.arc(width/2, height/2, 140, 0, 2*Math.PI);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.25)';
        ctx.beginPath();
        ctx.setLineDash([10, 15]);
        ctx.arc(width/2, height/2, 160, 0, 2*Math.PI);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Typography overlay
        ctx.font = 'bold 38px Orbitron';
        ctx.fillStyle = '#f1f3fa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 242, 254, 0.6)';
        ctx.shadowBlur = 10;
        ctx.fillText('PIXELCRYPT', width/2, height/2 - 25);
        
        ctx.font = 'bold 15px JetBrains Mono';
        ctx.fillStyle = '#00f2fe';
        ctx.shadowBlur = 0;
        ctx.fillText('DATA SECURED LOCK', width/2, height/2 + 25);
    }

    // --- TAB NAVIGATION ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'single-view') {
                updateFocusedViewport();
                buildZoomGrid();
            }
        });
    });

    viewportFocusSelect.addEventListener('change', () => {
        updateFocusedViewport();
    });

    function updateFocusedViewport() {
        const focusVal = viewportFocusSelect.value;
        let activeCanvas = null;
        
        if (focusVal === 'original' && originalImageData) {
            activeCanvas = canvasOriginal;
        } else if (focusVal === 'encrypted' && encryptedImageData) {
            activeCanvas = canvasEncrypted;
        } else if (focusVal === 'decrypted' && decryptedImageData) {
            activeCanvas = canvasDecrypted;
        }
        
        if (activeCanvas) {
            canvasFocused.width = activeCanvas.width;
            canvasFocused.height = activeCanvas.height;
            const ctx = canvasFocused.getContext('2d');
            ctx.drawImage(activeCanvas, 0, 0);
            
            canvasFocused.classList.remove('hidden');
            singleCanvasPlaceholder.classList.add('hidden');
        } else {
            canvasFocused.classList.add('hidden');
            singleCanvasPlaceholder.classList.remove('hidden');
        }
        
        buildZoomGrid();
    }

    // --- CRYPTOGRAPHIC ENGINE ACTIONS ---

    // Show processing status
    function showProgress(show, title = "", status = "") {
        if (show) {
            loaderTitle.textContent = title;
            loaderStatus.textContent = status;
            loaderProgressFill.style.width = '0%';
            processingOverlay.classList.remove('hidden');
        } else {
            processingOverlay.classList.add('hidden');
        }
    }

    // 1. XOR Stream Cipher
    function runXorStream(data, key, isEncrypting, progressCallback) {
        const seed = cyrb128(key);
        const prng = mulberry32(seed);
        const len = data.length;
        
        const CHUNK_SIZE = 100000;
        let offset = 0;
        
        function processChunk() {
            const end = Math.min(offset + CHUNK_SIZE, len);
            for (let i = offset; i < end; i += 4) {
                // XOR color channels R, G, B. Leave Alpha (i+3) untouched!
                const rMask = Math.floor(prng() * 256);
                const gMask = Math.floor(prng() * 256);
                const bMask = Math.floor(prng() * 256);
                
                data[i] = data[i] ^ rMask;
                data[i+1] = data[i+1] ^ gMask;
                data[i+2] = data[i+2] ^ bMask;
            }
            
            offset = end;
            const progress = (offset / len) * 100;
            progressCallback(progress);
            
            if (offset < len) {
                setTimeout(processChunk, 0);
            } else {
                progressCallback(100, true);
            }
        }
        processChunk();
    }

    // 2. Modular Additive (Pixel Caesar)
    function runCaesarMath(data, key, isEncrypting, progressCallback) {
        const seed = cyrb128(key);
        const prng = mulberry32(seed);
        const len = data.length;
        
        const CHUNK_SIZE = 100000;
        let offset = 0;
        
        function processChunk() {
            const end = Math.min(offset + CHUNK_SIZE, len);
            for (let i = offset; i < end; i += 4) {
                const rShift = Math.floor(prng() * 256);
                const gShift = Math.floor(prng() * 256);
                const bShift = Math.floor(prng() * 256);
                
                if (isEncrypting) {
                    data[i] = (data[i] + rShift) % 256;
                    data[i+1] = (data[i+1] + gShift) % 256;
                    data[i+2] = (data[i+2] + bShift) % 256;
                } else {
                    data[i] = (data[i] - rShift + 256) % 256;
                    data[i+1] = (data[i+1] - gShift + 256) % 256;
                    data[i+2] = (data[i+2] - bShift + 256) % 256;
                }
            }
            
            offset = end;
            const progress = (offset / len) * 100;
            progressCallback(progress);
            
            if (offset < len) {
                setTimeout(processChunk, 0);
            } else {
                progressCallback(100, true);
            }
        }
        processChunk();
    }

    // 3. RGB Channel Permutation
    function runChannelSwap(data, key, isEncrypting, progressCallback) {
        const seed = cyrb128(key);
        const prng = mulberry32(seed);
        const len = data.length;
        
        // Define all 6 possible channel mappings
        const permutations = [
            [0, 1, 2], // RGB
            [0, 2, 1], // RBG
            [1, 0, 2], // GRB
            [1, 2, 0], // GBR
            [2, 0, 1], // BRG
            [2, 1, 0]  // BGR
        ];
        
        const CHUNK_SIZE = 100000;
        let offset = 0;
        
        function processChunk() {
            const end = Math.min(offset + CHUNK_SIZE, len);
            for (let i = offset; i < end; i += 4) {
                const permIdx = Math.floor(prng() * 6);
                const perm = permutations[permIdx];
                
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                const channels = [r, g, b];
                
                if (isEncrypting) {
                    // Map channels into permuted arrangement
                    data[i] = channels[perm[0]];
                    data[i+1] = channels[perm[1]];
                    data[i+2] = channels[perm[2]];
                } else {
                    // Inverse mapping to restore
                    // Find original index mapping: where did channel j land?
                    // if perm = [1, 2, 0], it means original R (0) went to index 2, G (1) went to index 0, B (2) went to index 1.
                    // So data[i] is G, data[i+1] is B, data[i+2] is R.
                    // We reconstruct the channels properly!
                    const restored = [];
                    restored[perm[0]] = data[i];
                    restored[perm[1]] = data[i+1];
                    restored[perm[2]] = data[i+2];
                    
                    data[i] = restored[0];
                    data[i+1] = restored[1];
                    data[i+2] = restored[2];
                }
            }
            
            offset = end;
            const progress = (offset / len) * 100;
            progressCallback(progress);
            
            if (offset < len) {
                setTimeout(processChunk, 0);
            } else {
                progressCallback(100, true);
            }
        }
        processChunk();
    }

    // 4. Block & Row Shuffling (Fisher-Yates Block Shuffling)
    // Divides image into 8x8 blocks and shuffles positions deterministically based on key
    function runPixelShuffle(data, width, height, key, isEncrypting, progressCallback) {
        const seed = cyrb128(key);
        const prng = mulberry32(seed);
        
        const blockSize = 8;
        const cols = Math.ceil(width / blockSize);
        const rows = Math.ceil(height / blockSize);
        const totalBlocks = cols * rows;
        
        // Generate indexes
        const indices = [];
        for (let i = 0; i < totalBlocks; i++) {
            indices.push(i);
        }
        
        // Seeded Fisher-Yates Shuffle
        for (let i = totalBlocks - 1; i > 0; i--) {
            const j = Math.floor(prng() * (i + 1));
            const temp = indices[i];
            indices[i] = indices[j];
            indices[j] = temp;
        }
        
        // Make block arrays
        const tempData = new Uint8ClampedArray(data);
        
        // Helper to copy an 8x8 block from source array to target array
        function copyBlock(srcArr, srcCol, srcRow, destArr, destCol, destRow) {
            for (let by = 0; by < blockSize; by++) {
                const srcY = srcRow * blockSize + by;
                const destY = destRow * blockSize + by;
                
                if (srcY >= height || destY >= height) continue;
                
                for (let bx = 0; bx < blockSize; bx++) {
                    const srcX = srcCol * blockSize + bx;
                    const destX = destCol * blockSize + bx;
                    
                    if (srcX >= width || destX >= width) continue;
                    
                    const srcIdx = (srcY * width + srcX) * 4;
                    const destIdx = (destY * width + destX) * 4;
                    
                    destArr[destIdx] = srcArr[srcIdx];         // R
                    destArr[destIdx+1] = srcArr[srcIdx+1];     // G
                    destArr[destIdx+2] = srcArr[srcIdx+2];     // B
                    destArr[destIdx+3] = srcArr[srcIdx+3];     // A
                }
            }
        }
        
        // Distribute operations in chunks to keep UI running
        const CHUNK_BLOCKS = 300;
        let blockOffset = 0;
        
        function processBlockChunk() {
            const endBlock = Math.min(blockOffset + CHUNK_BLOCKS, totalBlocks);
            
            for (let i = blockOffset; i < endBlock; i++) {
                const currentBlockIdx = i;
                const targetBlockIdx = indices[i];
                
                const curRow = Math.floor(currentBlockIdx / cols);
                const curCol = currentBlockIdx % cols;
                
                const tarRow = Math.floor(targetBlockIdx / cols);
                const tarCol = targetBlockIdx % cols;
                
                if (isEncrypting) {
                    // Move block from original (cur) to shuffled target (tar)
                    copyBlock(tempData, curCol, curRow, data, tarCol, tarRow);
                } else {
                    // Decrypt: Reverse mapping
                    // Move block from shuffled position (tar) back to original (cur)
                    copyBlock(tempData, tarCol, tarRow, data, curCol, curRow);
                }
            }
            
            blockOffset = endBlock;
            const progress = (blockOffset / totalBlocks) * 100;
            progressCallback(progress);
            
            if (blockOffset < totalBlocks) {
                setTimeout(processBlockChunk, 0);
            } else {
                progressCallback(100, true);
            }
        }
        
        processBlockChunk();
    }

    // --- ENCRYPT EVENT LISTENER ---
    btnEncrypt.addEventListener('click', () => {
        if (!sourceImage || !originalImageData) return;
        
        const key = cryptoKey.value;
        const algo = algoSelect.value;
        
        if (!key) {
            alert("Security Key/Passphrase cannot be empty!");
            return;
        }
        
        showProgress(true, "Securing Pixel Matrix", "Initializing mathematical scrambling...");
        
        // Prepare canvas and output array
        canvasEncrypted.width = sourceImage.width;
        canvasEncrypted.height = sourceImage.height;
        const ctx = canvasEncrypted.getContext('2d');
        
        // Load original pixel data into scratch memory
        const tempImgData = ctx.createImageData(sourceImage.width, sourceImage.height);
        tempImgData.data.set(originalImageData.data);
        
        const progressCallback = (percent, done = false) => {
            loaderProgressFill.style.width = percent + '%';
            loaderStatus.textContent = `Applying cryptographic operations... ${Math.floor(percent)}%`;
            
            if (done) {
                // Done! Update UI
                ctx.putImageData(tempImgData, 0, 0);
                encryptedImageData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);
                
                canvasEncrypted.classList.remove('hidden');
                placeholderEnc.classList.add('hidden');
                encDim.textContent = `${sourceImage.width} × ${sourceImage.height}`;
                
                isEncrypted = true;
                btnDecrypt.disabled = false;
                downloadEncrypted.disabled = false;
                
                updateFocusedViewport();
                showProgress(false);
            }
        };
        
        // Run chosen visual cryptography algorithm
        setTimeout(() => {
            switch(algo) {
                case 'xor-stream':
                    runXorStream(tempImgData.data, key, true, progressCallback);
                    break;
                case 'caesar-math':
                    runCaesarMath(tempImgData.data, key, true, progressCallback);
                    break;
                case 'channel-swap':
                    runChannelSwap(tempImgData.data, key, true, progressCallback);
                    break;
                case 'pixel-shuffle':
                    runPixelShuffle(tempImgData.data, sourceImage.width, sourceImage.height, key, true, progressCallback);
                    break;
            }
        }, 150);
    });

    // --- DECRYPT EVENT LISTENER ---
    btnDecrypt.addEventListener('click', () => {
        if (!sourceImage || !encryptedImageData) return;
        
        const key = cryptoKey.value;
        const algo = algoSelect.value;
        
        if (!key) {
            alert("Security Key/Passphrase is required for decryption!");
            return;
        }
        
        showProgress(true, "Reconstructing Original Image", "Initiating inverse pixel equations...");
        
        // Prepare canvas and output array
        canvasDecrypted.width = sourceImage.width;
        canvasDecrypted.height = sourceImage.height;
        const ctx = canvasDecrypted.getContext('2d');
        
        // Load ENCRYPTED pixel data into scratch memory
        const tempImgData = ctx.createImageData(sourceImage.width, sourceImage.height);
        tempImgData.data.set(encryptedImageData.data);
        
        const progressCallback = (percent, done = false) => {
            loaderProgressFill.style.width = percent + '%';
            loaderStatus.textContent = `Solving pixel coordinate matrices... ${Math.floor(percent)}%`;
            
            if (done) {
                // Done! Update UI
                ctx.putImageData(tempImgData, 0, 0);
                decryptedImageData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);
                
                canvasDecrypted.classList.remove('hidden');
                placeholderDec.classList.add('hidden');
                decDim.textContent = `${sourceImage.width} × ${sourceImage.height}`;
                
                isDecrypted = true;
                downloadDecrypted.disabled = false;
                
                updateFocusedViewport();
                showProgress(false);
            }
        };
        
        // Run inverse algorithm
        setTimeout(() => {
            switch(algo) {
                case 'xor-stream':
                    runXorStream(tempImgData.data, key, false, progressCallback);
                    break;
                case 'caesar-math':
                    runCaesarMath(tempImgData.data, key, false, progressCallback);
                    break;
                case 'channel-swap':
                    runChannelSwap(tempImgData.data, key, false, progressCallback);
                    break;
                case 'pixel-shuffle':
                    runPixelShuffle(tempImgData.data, sourceImage.width, sourceImage.height, key, false, progressCallback);
                    break;
            }
        }, 150);
    });

    // --- DOWNLOAD ACTIONS ---
    function triggerDownload(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png'); // ALWAYS losslessly download as PNG!
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    downloadEncrypted.addEventListener('click', () => {
        if (isEncrypted) {
            triggerDownload(canvasEncrypted, 'pixelcrypt_encrypted_output.png');
        }
    });

    downloadDecrypted.addEventListener('click', () => {
        if (isDecrypted) {
            triggerDownload(canvasDecrypted, 'pixelcrypt_decrypted_output.png');
        }
    });

    // --- PIXEL INSPECTOR ENGINE ---
    // Generate Zoom HTML Grid (9x9)
    function buildZoomGrid() {
        magnifierGrid.innerHTML = '';
        for (let i = 0; i < 81; i++) {
            const pixelNode = document.createElement('div');
            pixelNode.className = 'zoom-pixel';
            pixelNode.id = `zoom-px-${i}`;
            if (i === 40) {
                pixelNode.classList.add('center-px');
            }
            magnifierGrid.appendChild(pixelNode);
        }
    }
    buildZoomGrid();

    // Mouse coordinates tracking and zoomed display
    canvasFocused.addEventListener('mousemove', (e) => {
        handleInspection(e);
    });

    canvasFocused.addEventListener('mouseenter', () => {
        buildZoomGrid();
    });

    function handleInspection(event) {
        if (!canvasFocused.width || canvasFocused.classList.contains('hidden')) return;
        
        const rect = canvasFocused.getBoundingClientRect();
        
        // Calculate coordinate scale factor since the canvas might be scaled visually in layout
        const scaleX = canvasFocused.width / rect.width;
        const scaleY = canvasFocused.height / rect.height;
        
        const mouseX = Math.floor((event.clientX - rect.left) * scaleX);
        const mouseY = Math.floor((event.clientY - rect.top) * scaleY);
        
        // Clamp bounds
        const x = Math.max(0, Math.min(canvasFocused.width - 1, mouseX));
        const y = Math.max(0, Math.min(canvasFocused.height - 1, mouseY));
        
        inspectorCoords.textContent = `X: ${x}, Y: ${y}`;
        
        // Extract 9x9 pixels surrounding (x,y)
        const ctx = canvasFocused.getContext('2d');
        const zoomSide = 9;
        const radius = 4;
        
        // Retrieve colors in 9x9 bounding box from canvas
        const boundingBox = ctx.getImageData(x - radius, y - radius, zoomSide, zoomSide);
        const bData = boundingBox.data;
        
        // Draw colors to zoom UI grid nodes
        let colorIdx = 0;
        for (let dy = -radius; dy <= radius; dy++) {
            const py = y + dy;
            for (let dx = -radius; dx <= radius; dx++) {
                const px = x + dx;
                const gridNode = document.getElementById(`zoom-px-${colorIdx}`);
                
                if (gridNode) {
                    if (px >= 0 && px < canvasFocused.width && py >= 0 && py < canvasFocused.height) {
                        // Locate matching pixel in getImageData array
                        // Since we grabbed a 9x9 bounding box centered at x,y, 
                        // the bounding box indexes go from 0..8 relative to px,py
                        const localX = dx + radius;
                        const localY = dy + radius;
                        const localIdx = (localY * zoomSide + localX) * 4;
                        
                        const r = bData[localIdx];
                        const g = bData[localIdx+1];
                        const b = bData[localIdx+2];
                        const a = bData[localIdx+3];
                        
                        gridNode.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                        
                        // Center Pixel Details Update
                        if (dx === 0 && dy === 0) {
                            updateCenterPixelHUD(r, g, b);
                        }
                    } else {
                        // Out of canvas boundary, color black/empty grid
                        gridNode.style.backgroundColor = '#000000';
                        if (dx === 0 && dy === 0) {
                            updateCenterPixelHUD(0, 0, 0);
                        }
                    }
                }
                colorIdx++;
            }
        }
    }

    function updateCenterPixelHUD(r, g, b) {
        valR.textContent = r;
        valG.textContent = g;
        valB.textContent = b;
        
        // Compute Hex
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        valHex.textContent = hex;
        colorPreview.style.backgroundColor = hex;
        
        // Compute Binary
        binR.textContent = r.toString(2).padStart(8, '0');
        binG.textContent = g.toString(2).padStart(8, '0');
        binB.textContent = b.toString(2).padStart(8, '0');
        
        // Progress Bars width
        barR.style.width = (r / 255 * 100) + '%';
        barG.style.width = (g / 255 * 100) + '%';
        barB.style.width = (b / 255 * 100) + '%';
    }
});
