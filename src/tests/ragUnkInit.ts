import { decode, i } from 'decoder';
import { Decompiler, DecompilerCache, Func, Method, TypeSystem } from 'decompiler';

export function test() {
    // Code for function Creature::ragUnk0::Init @ 0x00282848
    const testInstrs = [
        { address: 0x00282848, code: 0x27bdffd0 },
        { address: 0x0028284c, code: 0x7fb00000 },
        { address: 0x00282850, code: 0x0080802d },
        { address: 0x00282854, code: 0x7fb10010 },
        { address: 0x00282858, code: 0x7fbf0020 },
        { address: 0x0028285c, code: 0x00052080 },
        { address: 0x00282860, code: 0xae050010 },
        { address: 0x00282864, code: 0x0c0c6e56 },
        { address: 0x00282868, code: 0x00c0882d },
        { address: 0x0028286c, code: 0x8e030010 },
        { address: 0x00282870, code: 0x0000282d },
        { address: 0x00282874, code: 0x1860000a },
        { address: 0x00282878, code: 0xae020000 },
        { address: 0x0028287c, code: 0x8e020000 },
        { address: 0x00282880, code: 0x00051880 },
        { address: 0x00282884, code: 0x24a50001 },
        { address: 0x00282888, code: 0x00621821 },
        { address: 0x0028288c, code: 0xac600000 },
        { address: 0x00282890, code: 0x8e020010 },
        { address: 0x00282894, code: 0x00a2102a },
        { address: 0x00282898, code: 0x5440fff9 },
        { address: 0x0028289c, code: 0x8e020000 },
        { address: 0x002828a0, code: 0x3c013f80 },
        { address: 0x002828a4, code: 0x44810000 },
        { address: 0x002828a8, code: 0x00112080 },
        { address: 0x002828ac, code: 0xe6000008 },
        { address: 0x002828b0, code: 0x0c0c6e56 },
        { address: 0x002828b4, code: 0xe6000004 },
        { address: 0x002828b8, code: 0xae02000c },
        { address: 0x002828bc, code: 0x1a200009 },
        { address: 0x002828c0, code: 0x0000282d },
        { address: 0x002828c4, code: 0x2406ffff },
        { address: 0x002828c8, code: 0x8e02000c },
        { address: 0x002828cc, code: 0x00051880 },
        { address: 0x002828d0, code: 0x24a50001 },
        { address: 0x002828d4, code: 0x00621821 },
        { address: 0x002828d8, code: 0x00b1202a },
        { address: 0x002828dc, code: 0x1480fffa },
        { address: 0x002828e0, code: 0xac660000 },
        { address: 0x002828e4, code: 0x7bbf0020 },
        { address: 0x002828e8, code: 0x7bb10010 },
        { address: 0x002828ec, code: 0x7bb00000 },
        { address: 0x002828f0, code: 0x03e00008 },
        { address: 0x002828f4, code: 0x27bd0030 }
    ];

    const ts = TypeSystem.get();
    ts.initialize();
    const decompiler = Decompiler.current;

    const cls = ts.createStructure('ragUnk0');
    cls.addProperty('links', 0, ts.getType('undefined4**'));
    cls.addProperty('unk0', 4, ts.getType('f32'));
    cls.addProperty('unk1', 8, ts.getType('f32'));
    cls.addProperty('boneLinkIndices', 12, ts.getType('i32*'));
    cls.addProperty('count', 16, ts.getType('i32'));

    const sig = ts.getSignatureType(ts.getType('void'), [ts.getType('i32'), ts.getType('i32')], cls);

    const func = new Method(0, 0x00282848, sig);
    func.name = 'Init';
    func.setArgName(0, 'linkCount');

    const fnNewSig = ts.getSignatureType(ts.getType('void*'), [ts.getType('u32')]);
    const fnNew = new Func(1, 0x0031b958, fnNewSig);
    fnNew.name = 'vec_new';

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
            if (address === 0x0031b958) {
                return fnNew;
            }

            return null;
        }
    };

    decompiler.decompile(testInput, cache, funcDb);
}
