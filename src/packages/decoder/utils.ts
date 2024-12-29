/**
 * Extract a bit field from a 32-bit instruction
 * @param instruction The 32-bit instruction
 * @param start Starting bit position (from right)
 * @param length Number of bits to extract
 */
export function extractBits(instruction: number, start: number, length: number): number {
    const mask = (1 << length) - 1;
    return (instruction >>> start) & mask;
}

/**
 * Extract and sign-extend a bit field
 * @param instruction The 32-bit instruction
 * @param start Starting bit position (from right)
 * @param length Number of bits to extract
 */
export function extractSignedBits(instruction: number, start: number, length: number): number {
    const value = extractBits(instruction, start, length);
    const signBit = 1 << (length - 1);
    if (value & signBit) {
        // Sign extend
        return value | ~((1 << length) - 1);
    }
    return value;
}

/**
 * Convert a PC-relative branch offset to an absolute address
 * @param offset Branch offset (in instructions)
 * @param currentAddress Current PC address
 */
export function branchTarget(offset: number, currentAddress: number): number {
    // Branch target is relative to the next instruction (PC + 4)
    return currentAddress + 4 + (offset << 2);
}
