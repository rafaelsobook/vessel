export function createSimplex (seed) {
    const p = [];
    let s = seed * 2147483647;
    for (let i = 0; i < 256; i++) { s = (s * 16807) % 2147483647; p[i] = i; }
    for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = Math.floor((s / 2147483647) * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    const permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
    const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    const dot = (g, x, y) => g[0] * x + g[1] * y;
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    return (xin, yin) => {
        const s2 = (xin + yin) * F2;
        const i = Math.floor(xin + s2), j = Math.floor(yin + s2);
        const t = (i + j) * G2;
        const x0 = xin - (i - t), y0 = yin - (j - t);
        const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
        const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
        const ii = i & 255, jj = j & 255;
        const gi0 = permMod12[ii + perm[jj]];
        const gi1 = permMod12[ii + i1 + perm[jj + j1]];
        const gi2 = permMod12[ii + 1 + perm[jj + 1]];
        const calc = (x, y, gi) => {
            const n = 0.5 - x * x - y * y;
            return n < 0 ? 0 : n * n * n * n * dot(grad3[gi], x, y);
        };
        return 70 * (calc(x0, y0, gi0) + calc(x1, y1, gi1) + calc(x2, y2, gi2));
    };
};