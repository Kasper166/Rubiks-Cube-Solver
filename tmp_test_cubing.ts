import { cube3x3x3 } from 'cubing/puzzles';
import { KPattern } from 'cubing/kpuzzle';

async function main() {
    try {
        const k = await cube3x3x3.kpuzzle();
        console.log("KPuzzle methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(k)));
        const p = k.defaultPattern();
        console.log("KPattern methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(p)));
        console.log("KPattern keys:", Object.keys(p));
        console.log("KPatternData keys:", Object.keys(p.patternData));
    } catch (e) {
        console.error(e);
    }
}
main();
