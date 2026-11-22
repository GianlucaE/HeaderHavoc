import {describe, expect, test} from 'vitest';
import {coalesce} from '../src/core/serial';

function deferred(): {promise: Promise<void>; resolve: () => void} {
    let resolve = (): void => undefined;
    const promise = new Promise<void>((r) => {
        resolve = r;
    });
    return {promise, resolve};
}

/** A task whose first run signals that it started, then blocks until released. */
function blockingTask(): {run: () => Promise<number>; started: Promise<void>; release: () => void; runs: () => number} {
    const started = deferred();
    const gate = deferred();
    let runs = 0;
    const run = coalesce(async () => {
        runs++;
        const mine = runs;
        if (mine === 1) {
            started.resolve();
            await gate.promise;
        }
        return mine;
    });
    return {run, started: started.promise, release: gate.resolve, runs: () => runs};
}

describe('coalesce', () => {
    test('never runs two tasks at the same time', async () => {
        let running = 0;
        let peak = 0;
        const run = coalesce(async () => {
            running++;
            peak = Math.max(peak, running);
            await new Promise((r) => setTimeout(r, 5));
            running--;
        });

        const calls = [run()];
        await new Promise((r) => setTimeout(r, 1));
        calls.push(run(), run());
        await Promise.all(calls);

        expect(peak).toBe(1);
    });

    test('calls made before the queued run starts share it', async () => {
        let runs = 0;
        const run = coalesce(async () => {
            runs++;
        });

        await Promise.all([run(), run(), run()]);

        expect(runs).toBe(1);
    });

    test('calls made during a run share one follow-up run', async () => {
        const task = blockingTask();

        const first = task.run();
        await task.started;
        const followUps = [task.run(), task.run(), task.run()];
        task.release();
        await Promise.all([first, ...followUps]);

        expect(task.runs()).toBe(2);
    });

    test('a call made during a run gets the result of a later run', async () => {
        const task = blockingTask();

        const first = task.run();
        await task.started;
        const late = task.run();
        task.release();

        expect(await first).toBe(1);
        expect(await late).toBe(2);
    });

    test('keeps working after a run throws', async () => {
        let runs = 0;
        const run = coalesce(async () => {
            runs++;
            if (runs === 1) {
                throw new Error('boom');
            }
            return runs;
        });

        await expect(run()).rejects.toThrow('boom');
        await expect(run()).resolves.toBe(2);
    });
});
