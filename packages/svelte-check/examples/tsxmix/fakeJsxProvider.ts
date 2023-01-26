// kinda like the vhtml package (+ @types/vhtml) but simpler

declare namespace h {
    namespace JSX {
        interface IntrinsicElements {
            // lol div only jsx
            div: { [key: string]: any };
        }
    }
}

function h(...args: any[]): string {
    return `a string to fake you out`;
}

h.Fragment = (...args: any[]): string => {
    return `the fragment string`;
};

export default h;
