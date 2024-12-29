import { i } from 'decoder';

export interface JumpTableEntry {
    instructions: i.Instruction[];
    fallsThrough: boolean; // Whether this case falls through to the next
}

export interface IJumpTableResolver {
    /**
     * Check if an address could be a jump table
     * @param address The potential jump table address
     * @returns true if this address likely contains a jump table
     */
    canBeJumpTable(address: number): boolean;

    /**
     * Get the entries for a jump table
     * @param address The jump table address
     * @returns Array of jump table entries, or null if not a valid table
     */
    getJumpTableEntries(address: number): JumpTableEntry[] | null;
}
