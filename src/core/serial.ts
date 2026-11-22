/** Runs never overlap; calls made during a run share one follow-up run. */
export function coalesce<T>(task: () => Promise<T>): () => Promise<T> {
    let chain: Promise<unknown> = Promise.resolve();
    let queued: Promise<T> | undefined;

    return () => {
        if (queued !== undefined) {
            return queued;
        }

        const run = chain.then(() => {
            queued = undefined;
            return task();
        });
        queued = run;
        chain = run.catch(() => undefined);
        return run;
    };
}
