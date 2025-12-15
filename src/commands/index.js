const vscode = require('vscode');

/**
 * 注册所有命令
 * @param {vscode.ExtensionContext} context 扩展上下文
 * @param {NotesProvider} notesProvider 笔记提供者
 * @param {NotesViewProvider} viewProvider 视图提供者
 */
function registerCommands(context, notesProvider, viewProvider) {
    const commands = [
        vscode.commands.registerCommand('enotes.refreshNotes', () => {
            notesProvider.loadExistingNotes();
        }),

        vscode.commands.registerCommand('enotes.addNote', () => {
            viewProvider.showNewNoteInput();
        }),

        vscode.commands.registerCommand('enotes.deleteNote', (note) => {
            notesProvider.deleteNote(note);
        }),

        vscode.commands.registerCommand('enotes.openNote', async (note) => {
            notesProvider.panelController.showPanel(note);
        }),

        vscode.commands.registerCommand('enotes.renameNote', (note) => {
            notesProvider.renameNote(note);
        }),

        vscode.commands.registerCommand('enotes.editTags', (note) => {
            notesProvider.editTags(note);
        }),

        vscode.commands.registerCommand('enotes.editTagsInline', (noteTitle) => {
            if (viewProvider && viewProvider._view) {
                viewProvider._view.webview.postMessage({
                    command: 'triggerEditTags',
                    title: noteTitle
                });
            }
        }),

        vscode.commands.registerCommand('enotes.getNoteByTitle', (title) => {
            return notesProvider.getNoteByTitle(title);
        })
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

module.exports = { registerCommands };
