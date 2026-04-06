/**
 * types.d.ts — Global type augmentations for Spectro-Cube
 */

// Allow importing worker files
declare module '*?worker' {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}


export {};