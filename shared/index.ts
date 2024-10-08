export function packCordsToToken(X: number, Y: number): bigint {
    // Shift X by 48 bits and combine directly with Y using bitwise OR
    return (BigInt(X) << 48n) + BigInt(Y);
}

export function createTokensForRange(xStart: number, xEnd: number, yStart: number, yEnd: number): bigint[] {
    const rangeX = xEnd - xStart + 1;
    const rangeY = yEnd - yStart + 1;
    const totalTokens = rangeX * rangeY;

    // Pre-allocate the result array
    const tokens: bigint[] = new Array(totalTokens);

    let index = 0;

    // Flattened and optimized loop
    let X = xStart;
    while (X <= xEnd) {
        const bigXShifted = BigInt(X++) << 48n; // Precompute X shift before entering inner loop

        let Y = yStart;
        while (Y <= yEnd) {
            tokens[index++] = bigXShifted + BigInt(Y++);
        }
    }

    return tokens;
}