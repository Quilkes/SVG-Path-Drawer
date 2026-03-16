import { Fragment } from 'react';

const shortcuts = [
  { key: 'L-drag',       desc: 'Drag point(s)' },
  { key: 'R-click',      desc: 'Add/remove from selection' },
  { key: 'Shift+drag',   desc: 'Box select' },
  { key: 'G',            desc: 'Grab selected points' },
  { key: 'X / Y',        desc: 'Lock grab to axis (in Grab)' },
  { key: 'E',            desc: 'Extrude selected point(s)' },
  { key: 'A',            desc: 'Select / deselect all' },
  { key: 'X / Del',      desc: 'Delete selected pts' },
  { key: '+ / -',        desc: 'Zoom in / out' },
  { key: 'Mid-drag',     desc: 'Pan canvas' },
  { key: 'Ctrl+Scroll',  desc: 'Zoom toward cursor' },
  { key: 'Ctrl+0',       desc: 'Reset view (1:1)' },
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
