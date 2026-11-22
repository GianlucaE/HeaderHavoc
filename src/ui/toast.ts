import {el} from './components';

const VISIBLE_MS = 6000;

let timer: ReturnType<typeof setTimeout> | undefined;

function hide(): void {
    document.getElementById('toast')?.classList.remove('show');
}

export function showUndo(message: string, undo: () => void): void {
    let toast = document.getElementById('toast');
    if (toast === null) {
        toast = el('div', {id: 'toast', class: 'toast', role: 'status'});
        document.body.append(toast);
    }

    const action = el('button', {type: 'button', class: 'toast-action'}, ['Undo']);
    action.addEventListener('click', () => {
        hide();
        undo();
    });

    toast.replaceChildren(el('span', {}, [message]), action);
    toast.classList.add('show');

    if (timer !== undefined) {
        clearTimeout(timer);
    }
    timer = setTimeout(hide, VISIBLE_MS);
}
