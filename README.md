# Neat Checklist

Neat Checklist is a lightweight, client-side checklist app focused on simplicity and minimal UI overhead. It's designed for daily tasks, project tracking, or any scenario where you want a fast, local way to organize items without server dependencies.

## Features

- **Operations**: Add, edit, and delete tasks.
- **Priority system**: Assign and update priorities using a color-coded scheme.
- **Completion toggle**: Mark tasks done with a checkbox.
- **Drag-and-drop**: Reorder tasks manually.
- **Automatic sorting**: Sort by priority and push completed items to the bottom.
- **Bulk actions**: Delete all finished tasks.
- **Undo support**: Revert recent changes.
- **Responsive design**: Works on desktop and mobile.
- **Dark mode support**
- **Export / copy**: Export your checklist or copy it to the clipboard in serialized format which can be parsed by the input box.

## How It Works

Each task supports a priority level, represented with color-coded buttons. You can:

- Edit priority or delete a single task via a contextual menu.
- Open a "priority editing mode" to quickly adjust multiple tasks.
- On smaller screens, priority controls are rendered below each item to keep the UI uncluttered.
- Sort by priority
- Change the text entry box to insert items at the top or bottom of the list

Task ordering is preserved with drag-and-drop, and changes automatically propagate through the UI. Undo functionality is implemented in-memory for immediate reversal of recent edits.

## Getting Started

1. Clone or download the repository.
2. Open `index.html` in your browser.
3. Add, edit, reorder, and test tasks locally.
4. Live demo available at: [https://kirkcorwin.github.io/neat-checklist/](https://kirkcorwin.github.io/neat-checklist/)
5. test_checklist.txt can be dropped onto the page to load the checklist, or the contents can be copied and pasted into the input box

## Why This Exists

I wanted a simple checklist with prioritization that I could more easily change the functionality of, and had extremely low friction in use.

## License

MIT License. Feel free to fork, modify, and learn from the code. Attribution is appreciated.
