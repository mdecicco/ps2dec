# ps2dec
Decompiler for the MIPS R5900 architecture (Playstation 2) written in TypeScript

This project is currently under development but is intended to be used in conjunction with a modified PCSX2 that exposes a debugger API remotely.
There is also a UI component for this which I'll upload once I refactor it to use this.

# What's left:
(includes but is not limited to, in no particular order)
- Fix some bugs with AST building
- More variable deduction analysis steps
- Replace AST->code prototype with robust code generator
    - Address <-> line of code mapping
    - Register/stack <-> variable mapping
    - Variable/location <-> text range mapping
- Merge the incomplete UI project into this one
    - Refactor analyzers to use this library instead of the old decoding logic
    - Add decompilation output view that tracks the function containing the cursor in the listing view, if any
          - Variable renaming / splitting, type assignment
          - Highlight disassembled instructions on text selection
          - Highlight decompiled code on instruction selection in disassembly view
          - Function signature editing
    - Integrate decompiler cache with the DB
    - Design a UI for interacting with the type system
- Store variables and SSA info in decompiler cache, use the cached data instead of reconstructing
- Modify PCSX2 to expose its debugging functionality for remote use by this library
    - Break / Continue
    - Set breakpoint
    - Delete breakpoint
    - Read / write registers / memory
    - Notify on break with register values
    - Persistent live memory snapshots?
- Debug mode
    - Track register values
    - Data tooltips for variables in decompiled code
    - Set/remove breakpoints in margin
    - UI for interacting with the PCSX2 debugger

...Believe it or not the hard part is mostly over
