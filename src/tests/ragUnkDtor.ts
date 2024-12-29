import { decode, i } from 'decoder';
import { Decompiler, DecompilerCache, Func, Method, TypeSystem } from 'decompiler';

export function test() {
    // Code for function Creature::ragUnk0::Init @ 0x00282848
    const testInstrs = [
        { address: 0x00282788, code: 0x27bdffc0 },
        { address: 0x0028278c, code: 0x7fb20020 },
        { address: 0x00282790, code: 0x7fb10010 },
        { address: 0x00282794, code: 0x7fbf0030 },
        { address: 0x00282798, code: 0x0080882d },
        { address: 0x0028279c, code: 0x7fb00000 },
        { address: 0x002827a0, code: 0x8e220000 },
        { address: 0x002827a4, code: 0x1040001a },
        { address: 0x002827a8, code: 0x00a0902d },
        { address: 0x002827ac, code: 0x8e220010 },
        { address: 0x002827b0, code: 0x18400012 },
        { address: 0x002827b4, code: 0x0000802d },
        { address: 0x002827b8, code: 0x8e230000 },
        { address: 0x002827bc, code: 0x00000000 },
        { address: 0x002827c0, code: 0x00101080 },
        { address: 0x002827c4, code: 0x00431021 },
        { address: 0x002827c8, code: 0x8c460000 },
        { address: 0x002827cc, code: 0x10c00006 },
        { address: 0x002827d0, code: 0x24050003 },
        { address: 0x002827d4, code: 0x8cc20024 },
        { address: 0x002827d8, code: 0x84440008 },
        { address: 0x002827dc, code: 0x8c43000c },
        { address: 0x002827e0, code: 0x0060f809 },
        { address: 0x002827e4, code: 0x00c42021 },
        { address: 0x002827e8, code: 0x8e220010 },
        { address: 0x002827ec, code: 0x26100001 },
        { address: 0x002827f0, code: 0x0202102a },
        { address: 0x002827f4, code: 0x5440fff2 },
        { address: 0x002827f8, code: 0x8e230000 },
        { address: 0x002827fc, code: 0x8e240000 },
        { address: 0x00282800, code: 0x10800003 },
        { address: 0x00282804, code: 0x00000000 },
        { address: 0x00282808, code: 0x0c0c6e62 },
        { address: 0x0028280c, code: 0x00000000 },
        { address: 0x00282810, code: 0x0c0c6e46 },
        { address: 0x00282814, code: 0x8e24000c },
        { address: 0x00282818, code: 0x32420001 },
        { address: 0x0028281c, code: 0x10400004 },
        { address: 0x00282820, code: 0x7bbf0030 },
        { address: 0x00282824, code: 0x0c0c6e46 },
        { address: 0x00282828, code: 0x0220202d },
        { address: 0x0028282c, code: 0x7bbf0030 },
        { address: 0x00282830, code: 0x7bb20020 },
        { address: 0x00282834, code: 0x7bb10010 },
        { address: 0x00282838, code: 0x7bb00000 },
        { address: 0x0028283c, code: 0x03e00008 },
        { address: 0x00282840, code: 0x27bd0040 }
    ];

    const decompiler = Decompiler.get();
    const ts = TypeSystem.get();

    const cls = ts.createStructure('ragUnk0');
    cls.addProperty('links', 0, ts.getType('undefined4**'));
    cls.addProperty('unk0', 4, ts.getType('f32'));
    cls.addProperty('unk1', 8, ts.getType('f32'));
    cls.addProperty('boneLinkIndices', 12, ts.getType('i32*'));
    cls.addProperty('count', 16, ts.getType('i32'));

    const sig = ts.getSignatureType(ts.getType('void'), [ts.getType('u64')], cls);

    const func = new Method(0, 0x00282848, sig);

    const fnVecDeleteSig = ts.getSignatureType(ts.getType('void'), [ts.getType('void*')]);
    const fnVecDelete = new Func(1, 0x0031b988, fnVecDeleteSig);
    fnVecDelete.name = 'vec_delete';

    const fnDeleteSig = ts.getSignatureType(ts.getType('void'), [ts.getType('void*')]);
    const fnDelete = new Func(1, 0x0031b918, fnDeleteSig);
    fnDelete.name = 'delete';

    const cache = new DecompilerCache(func);

    const testInput = testInstrs.map(instr => {
        try {
            return decode(instr.code, instr.address);
        } catch (err) {
            return new i.nop(instr.address);
        }
    });

    const funcDb = {
        findFunctionByAddress: (address: number) => {
            if (address === 0x0031b988) {
                return fnVecDelete;
            }
            if (address === 0x0031b918) {
                return fnDelete;
            }

            return null;
        }
    };

    decompiler.decompile(testInput, cache, funcDb);
}
