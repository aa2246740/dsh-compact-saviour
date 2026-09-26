declare const COPY: {
    compress: string[];
    merge: string[];
};
/** Waiting copy is decorative, not a claim that a new processing stage finished. */
export declare function WaitingCopy({ stage }: {
    stage: keyof typeof COPY;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=waiting-copy.d.ts.map