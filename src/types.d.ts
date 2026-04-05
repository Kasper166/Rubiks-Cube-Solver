import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'alg'?: string;
        'puzzle'?: string;
        'visualization'?: string;
        'control-panel'?: string;
        'background'?: string;
        'hint-facelets'?: string;
        'stickering'?: string;
        'experimental-stickering'?: string;
      };
    }
  }
}
export {};