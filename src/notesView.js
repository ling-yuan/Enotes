const fs = require('fs');
const path = require('path');

/**
 * 笔记列表视图提供者
 */
class NotesViewProvider {
    constructor(context, notesProvider) {
        this._view = undefined;
        this.context = context;
        this.notesProvider = notesProvider;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this._getHtmlContent();

        // 监听视图可见性变化
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.refresh();
            }
        });

        // 监听来自webview的消息
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'filter':
                    this.notesProvider.setFilter(message.text);
                    this.refresh();
                    break;
                case 'openNote':
                    const note = this.notesProvider.notes.find(n => n.title === message.title);
                    if (note) {
                        await this.notesProvider.panelController.showPanel(note);
                    }
                    break;
                case 'deleteNote':
                    const noteToDelete = this.notesProvider.notes.find(n => n.title === message.title);
                    if (noteToDelete) {
                        await this.notesProvider.deleteNote(noteToDelete);
                        this.refresh();
                    }
                    break;
                case 'renameNote':
                    const noteToRename = this.notesProvider.notes.find(n => n.title === message.oldTitle);
                    if (noteToRename && message.newTitle) {
                        await this.notesProvider.renameNote(noteToRename, message.newTitle);
                        this.refresh();
                    }
                    break;
                case 'editTags':
                    const noteToEditTags = this.notesProvider.notes.find(n => n.title === message.title);
                    if (noteToEditTags && message.tags !== undefined) {
                        await this.notesProvider.editTags(noteToEditTags, message.tags);
                        this.refresh();
                    }
                    break;
                case 'addNote':
                    await this.notesProvider.addNote(message.title);
                    this.refresh();
                    break;
            }
        });

        // 初始刷新
        this.refresh();
    }

    refresh() {
        if (this._view) {
            const filterText = this.notesProvider.filterText;
            let filteredNotes = this.notesProvider.notes;

            if (filterText) {
                const filterLower = filterText.toLowerCase();
                filteredNotes = this.notesProvider.notes.filter(note =>
                    note.title.toLowerCase().includes(filterLower)
                );
            }

            this._view.webview.postMessage({
                command: 'update',
                notes: filteredNotes.map(n => ({ title: n.title, tags: n.tags })),
                filterText: filterText
            });
        }
    }

    showNewNoteInput() {
        if (this._view) {
            this._view.webview.postMessage({ command: 'showNewNoteInput' });
        }
    }

    _getHtmlContent() {
        const htmlPath = path.join(this.context.extensionPath, 'src', 'views', 'notesView.html');
        return fs.readFileSync(htmlPath, 'utf8');
    }
}

module.exports = { NotesViewProvider };
