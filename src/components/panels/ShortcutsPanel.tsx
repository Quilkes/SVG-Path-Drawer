import { Fragment } from 'react';

const shortcuts = [
  { key: 'L-click',      desc: 'Select point' },
  { key: 'R-click',      desc: 'Add/remove from sel' },
  { key: 'Shift+drag',   desc: 'Box select' },
  { key: 'G',            desc: 'Grab selected' },
  { key: 'A',            desc: 'Select / deselect all' },
  { key: 'X / Del',      desc: 'Delete selected pts' },
  { key: 'Ctrl+Z',       desc: 'Undo' },
  { key: 'Ctrl+Y',       desc: 'Redo' },
  { key: 'Ctrl+C/V',     desc: 'Copy / paste pts' },
  { key: 'Esc',          desc: 'Cancel / deselect' },
];

export function ShortcutsPanel() {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 p-2">
      {shortcuts.map(({ key, desc }) => (
        <Fragment key={key}>
          <span className="font-mono text-[10px] text-accent font-medium">{key}</span>
          <span className="text-[10px] text-dim">{desc}</span>
        </Fragment>
      ))}
    </div>
  );
}
