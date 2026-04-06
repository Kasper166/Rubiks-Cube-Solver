import { cube3x3x3 } from 'cubing/puzzles';

async function main() {
    const k = await cube3x3x3.kpuzzle();
    // try search for fromFaceletString in k
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(k));
    console.log("KPuzzle methods:", methods);
    
    // Check if we can use KPattern.fromFaceletString?
    // Wait... if k instance has a specific method?
}
main();
