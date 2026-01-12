// Simple QR Code generator
// Based on qr.js - minimal QR code generation

const QRCode = {
  generate(canvas, text, size = 150) {
    const qr = this.createQR(text);
    const ctx = canvas.getContext('2d');
    const cellSize = size / qr.length;

    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#000000';
    for (let y = 0; y < qr.length; y++) {
      for (let x = 0; x < qr[y].length; x++) {
        if (qr[y][x]) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  },

  createQR(text) {
    // Simple QR matrix generation (version 2, 25x25)
    const size = 25;
    const matrix = Array(size).fill(null).map(() => Array(size).fill(false));

    // Add finder patterns
    this.addFinderPattern(matrix, 0, 0);
    this.addFinderPattern(matrix, size - 7, 0);
    this.addFinderPattern(matrix, 0, size - 7);

    // Add timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }

    // Add alignment pattern
    this.addAlignmentPattern(matrix, size - 9, size - 9);

    // Encode data
    const data = this.encodeData(text);
    this.placeData(matrix, data);

    return matrix;
  },

  addFinderPattern(matrix, x, y) {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const isEdge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const isInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        matrix[y + dy][x + dx] = isEdge || isInner;
      }
    }
    // Separator
    for (let i = 0; i < 8; i++) {
      if (y + 7 < matrix.length) matrix[y + 7][x + i] = false;
      if (x + 7 < matrix.length) matrix[y + i][x + 7] = false;
    }
  },

  addAlignmentPattern(matrix, x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const isEdge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
        const isCenter = dx === 0 && dy === 0;
        matrix[y + dy][x + dx] = isEdge || isCenter;
      }
    }
  },

  encodeData(text) {
    const bits = [];
    // Mode indicator (alphanumeric)
    bits.push(0, 0, 1, 0);
    // Character count (9 bits for version 2)
    const len = text.length;
    for (let i = 8; i >= 0; i--) bits.push((len >> i) & 1);
    // Data
    for (const char of text) {
      const code = char.charCodeAt(0);
      for (let i = 7; i >= 0; i--) bits.push((code >> i) & 1);
    }
    return bits;
  },

  placeData(matrix, data) {
    let dataIndex = 0;
    const size = matrix.length;
    let up = true;

    for (let x = size - 1; x >= 0; x -= 2) {
      if (x === 6) x = 5;

      for (let i = 0; i < size; i++) {
        const y = up ? size - 1 - i : i;

        for (let dx = 0; dx <= 1; dx++) {
          const col = x - dx;
          if (!this.isReserved(matrix, col, y, size)) {
            matrix[y][col] = dataIndex < data.length ? data[dataIndex++] === 1 : false;
          }
        }
      }
      up = !up;
    }
  },

  isReserved(matrix, x, y, size) {
    // Finder patterns
    if (x < 9 && y < 9) return true;
    if (x < 9 && y >= size - 8) return true;
    if (x >= size - 8 && y < 9) return true;
    // Timing
    if (x === 6 || y === 6) return true;
    // Alignment
    if (x >= size - 11 && x <= size - 7 && y >= size - 11 && y <= size - 7) return true;
    return false;
  }
};

window.QRCode = QRCode;
