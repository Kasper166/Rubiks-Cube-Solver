declare global {
    namespace JSX {
        interface IntrinsicElements {
            'twisty-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                'alg'?: string;
                'puzzle'?: string;
                'visualization'?: string;
                'control-panel'?: string;
                'experimental-stickering'?: string;
            };
        }
    }
}
export {};