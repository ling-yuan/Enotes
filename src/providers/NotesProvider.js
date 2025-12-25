const vscode = require('vscode');
const { PanelController } = require('../controllers/PanelController');
const { TagManager } = require('../services/TagManager');
const { NoteItem } = require('../models/NoteItem');
const { getNotesPath, getNoteUri, getConfig } = require('../utils/config');

/**
 * 笔记数据提供者
 */
class NotesProvider {
    constructor(context) {
        this.panelController = new PanelController(context);
        this.tagManager = new TagManager();
        this.notes = [];
        this.filterText = '';
        this.viewProvider = null;
        this._initPromise = null;
    }

    /**
     * 初始化提供者
     * @returns {Promise<void>}
     */
    async initialize() {
        if (!this._initPromise) {
            this._initPromise = (async () => {
                try {
                    await this.tagManager.initializeTags();
                    await this.loadExistingNotes();
                } catch (error) {
                    vscode.window.showErrorMessage(`初始化失败: ${error.message}`);
                }
            })();
        }
        return this._initPromise;
    }

    /**
     * 加载已有笔记
     * @returns {Promise<void>}
     */
    async loadExistingNotes() {
        try {
            // 检查所有已打开的面板
            const openedNotes = Array.from(this.panelController.webviewManager.panels.keys());
            for (const noteTitle of openedNotes) {
                const notePath = this.panelController.webviewManager.notePaths.get(noteTitle);
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(notePath));
                } catch (error) {
                    await this.panelController.closePanel({ title: noteTitle });
                    vscode.window.showWarningMessage(`笔记 "${noteTitle}" 已被删除，已关闭对应面板`);
                }
            }

            this.notes = [];
            this.filterText = '';

            const notesPath = await getNotesPath();
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(notesPath));

            this.notes = await Promise.all(files
                .filter(([name]) => name.endsWith('.md'))
                .map(async ([name]) => {
                    const title = name.slice(0, -3);
                    const tags = this.tagManager.getTags(title);
                    const pinned = this.tagManager.getPinned(title);
                    return new NoteItem(title, tags, vscode.TreeItemCollapsibleState.None, pinned);
                }));

            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`加载笔记失败: ${error.message}`);
        }
    }

    /**
     * 刷新笔记列表
     */
    refresh() {
        if (this.viewProvider) {
            this.viewProvider.refresh();
        }
    }

    /**
     * 添加笔记
     * @param {string} title 笔记标题
     * @returns {Promise<void>}
     */
    async addNote(title) {
        try {
            if (this.notes.some(n => n.title === title)) {
                vscode.window.showWarningMessage(`笔记 "${title}" 已存在`);
                return;
            }

            const noteFileUri = await getNoteUri(title);
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(noteFileUri, encoder.encode(''));

            const note = new NoteItem(title, [], vscode.TreeItemCollapsibleState.None, false);
            this.notes.push(note);
            this.refresh();

            const openNoteRightNow = await getConfig("openNoteRightNow");
            if (openNoteRightNow) {
                this.panelController.showPanel(note);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`创建笔记失败: ${error.message}`);
        }
    }

    /**
     * 删除笔记
     * @param {NoteItem} note 笔记
     * @returns {Promise<void>}
     */
    async deleteNote(note) {
        try {
            const noteFileUri = await getNoteUri(note.title);

            await this.panelController.closePanel(note);

            try {
                await this.tagManager.deleteTag(note.title);
            } catch (tagError) {
                vscode.window.showWarningMessage(`删除笔记标签失败: ${tagError.message}`);
            }

            try {
                await vscode.workspace.fs.delete(noteFileUri);
            } catch (fileError) {
                vscode.window.showErrorMessage(`删除笔记文件失败: ${fileError.message}`);
                return;
            }

            const index = this.notes.indexOf(note);
            if (index > -1) {
                this.notes.splice(index, 1);
                this.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`删除笔记失败: ${error.message}`);
        }
    }

    /**
     * 重命名笔记
     * @param {NoteItem} note 笔记
     * @param {string} newTitle 新标题
     * @returns {Promise<void>}
     */
    async renameNote(note, newTitle) {
        if (!newTitle || newTitle === note.title) {
            return;
        }

        if (this.notes.some(n => n.title === newTitle && n !== note)) {
            vscode.window.showWarningMessage(`笔记 "${newTitle}" 已存在`);
            return;
        }

        const oldUri = await getNoteUri(note.title);
        const oldTitle = note.title;

        try {
            const newUri = await getNoteUri(newTitle);
            const content = await vscode.workspace.fs.readFile(oldUri);
            await vscode.workspace.fs.writeFile(newUri, content);
            await vscode.workspace.fs.delete(oldUri);
            this.tagManager.renameTag(note.title, newTitle);
            note.title = newTitle;
            note.label = `${note.title}  ${note.formatTags()}`;
            await this.panelController.updateNoteTitle(oldTitle, newTitle, note.tags, newUri.fsPath);
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`重命名笔记失败: ${error.message}`);
        }
    }

    /**
     * 编辑笔记标签
     * @param {NoteItem} note 笔记
     * @param {string} tagsInput 标签输入字符串
     * @returns {Promise<void>}
     */
    async editTags(note, tagsInput) {
        const newTags = tagsInput.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        note.tags = [...new Set(newTags)];
        note.label = `${note.title}  ${note.formatTags()}`;

        await this.tagManager.changeTag(note.title, note.tags);
        await this.panelController.updateNoteTags(note.title, note.tags);

        this.refresh();
    }

    /**
     * 设置筛选文本
     * @param {string} text 筛选文本
     */
    setFilter(text) {
        this.filterText = text || '';
        this.refresh();
    }

    /**
     * 根据标题获取笔记对象
     * @param {string} title 笔记标题
     * @returns {NoteItem} 笔记对象
     */
    getNoteByTitle(title) {
        const note = this.notes.find(n => n.title === title);
        if (note) {
            return note;
        }
        throw new Error(`笔记 "${title}" 不存在`);
    }
    /**
     * 切换笔记置顶状态
     * @param {NoteItem} note 笔记
     * @param {boolean} pinned 是否置顶
     * @returns {Promise<void>}
     */
    async togglePin(note, pinned) {
        note.pinned = pinned;
        await this.tagManager.setPinned(note.title, pinned);
        this.refresh();
    }
}

module.exports = { NotesProvider };
