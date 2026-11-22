import {countLive} from '../core/compile';
import type {Config} from '../core/types';
import {plural} from './format';

export function must<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (node === null) {
        throw new Error(`Missing element #${id}`);
    }
    return node as T;
}

export function renderShell(config: Config): void {
    const live = countLive(config);

    must('global-toggle').setAttribute('aria-checked', String(config.enabled));
    must('pulse').classList.toggle('is-live', live > 0);
    must('status').textContent = config.enabled
        ? `${live} active · ${plural(config.profiles.length, 'profile')}`
        : 'Disabled — no headers are being rewritten';
}
