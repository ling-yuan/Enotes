// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { WebviewPanelManager } = require('./webview');
const { NotesViewProvider } = require('./notesView');

const ALLNOTES = "全部笔记";
const SEARCHRESULT = "搜索结果";
const EMPTYNOTES = "暂无笔记";
const EMPTYSEARCH = "未找到笔记";

/**
 * 用于获取插件配置
 * @returns {Promise<any>} 插件配置
 */
async function getConfig(param) {
    return vscode.workspace.getConfiguration('enotes').get(param);
}

/**
 * 用于获取笔记保存路径
 * @returns {Promise<string>} 笔记保存路径
 */
async function getNotesPath() {
    let notesPath = await getConfig('notesPath');

    if (!notesPath) {
        const workspaceFolder = vscode.workspace.workspaceFolders;
        if (!workspaceFolder) {
            throw new Error('请先打开一个工作区! ');
        }
        notesPath = vscode.Uri.joinPath(workspaceFolder[0].uri, '.vscode', 'notes').fsPath;
    }

    // 确保目录存在
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(notesPath));
    return notesPath;
}

/**
 * 用于获取笔记文件的 Uri
 * @param {string} noteTitle 笔记标题
 * @returns {Promise<vscode.Uri>} 笔记文件的 Uri
 */
async function getNoteUri(noteTitle) {
    const title = noteTitle.split('[')[0].trim();
    const notesPath = await getNotesPath();
    return vscode.Uri.file(`${notesPath}/${title}.md`);
}


/**
 * 活动面板控制
 */
class PanelController {
    // 构造函数，用于初始化对象
    constructor(context) {
        this.webviewManager = new WebviewPanelManager(context);
    }

    /**
     * 显示笔记面板
     * @param {NoteItem} note 笔记项
     */
    async showPanel(note) {
        const noteUri = await getNoteUri(note.title);
        await this.webviewManager.createOrShow(note.title, noteUri.fsPath, note.tags);
    }

    /**
     * 关闭指定标题的面板
     * @param {NoteItem} note 笔记项
     * @returns {Promise<boolean>} 是否成功关闭面板
     */
    async closePanel(note) {
        return await this.webviewManager.closePanel(note.title);
    }

    /**
     * 更新笔记标题
     * @param {string} oldTitle 旧标题
     * @param {string} newTitle 新标题
     * @param {string[]} tags 标签数组
     * @param {string} newPath 新文件路径
     */
    async updateNoteTitle(oldTitle, newTitle, tags, newPath) {
        await this.webviewManager.updateNoteTitle(oldTitle, newTitle, tags, newPath);
    }

    /**
     * 更新笔记标签
     * @param {string} noteTitle 笔记标题
     * @param {string[]} tags 新标签数组
     */
    async updateNoteTags(noteTitle, tags) {
        await this.webviewManager.updateNoteTags(noteTitle, tags);
    }
}

/**
 * 标签管理器
 */
class TagManager {
    constructor() {
        this.tags = new Map();
    }

    /**
     * 初始化标签
     * @returns {Promise<void>}
     */
    async initializeTags() {
        const notesPath = await getNotesPath();
        const tagsFileUri = vscode.Uri.file(`${notesPath}/tags.json`);
        try {
            const fileContent = await vscode.workspace.fs.readFile(tagsFileUri);
            let tagsData = JSON.parse(new TextDecoder().decode(fileContent));

            if (tagsData && typeof tagsData === 'object') {
                this.tags = new Map(Object.entries(tagsData));
            } else {
                this.tags = new Map();
                await this.saveTags(); // 保存空的标签文件
            }
        }
        catch (error) {
            // 如果文件不存在，创建一个空的标签文件
            this.tags = new Map();
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(tagsFileUri, encoder.encode('{}'));
        }
    }

    /**
     * 保存标签
     * @returns {Promise<void>}
     */
    async saveTags() {
        const notesPath = await getNotesPath();
        const tagsFile = vscode.Uri.file(`${notesPath}/tags.json`);

        // 保存更新后的标签数据
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(
            tagsFile,
            encoder.encode(JSON.stringify(Object.fromEntries(this.tags), null, 2))
        );
    }

    /**
     * 更改标签
     * @param {string} key 键
     * @param {any} value 值
     * @returns {Promise<void>}
     */
    async changeTag(key, value) {
        // 如果value不是数组，则将其转换为数组
        if (!Array.isArray(value)) {
            value = [value];
        }
        this.tags.set(key, value);
        await this.saveTags();
    }

    /**
     * 重命名标签
     * @param {string} oldKey 旧键
     * @param {string} newKey 新键
     * @returns {Promise<void>}
     */
    async renameTag(oldKey, newKey) {
        let v = this.tags.get(oldKey);
        if (v) {
            this.tags.set(newKey, v);
            this.tags.delete(oldKey);
        }
        else {
            this.tags.set(newKey, []);
        }
        await this.saveTags();
    }

    /**
     * 删除所有标签
     * @param {string} key 键
     * @returns {Promise<void>}
     */
    async deleteTag(key) {
        this.tags.delete(key);
        await this.saveTags();
    }

    /**
     * 获取标签
     * @param {string} title 标题
     * @returns {string[]} 标签数组
     */
    getTags(title) {
        return this.tags.get(title) || [];
    }
}

/**
 * 笔记列表项
 */
class NoteItem extends vscode.TreeItem {
    constructor(title, tags = [], collapsibleState) {
        super(title, collapsibleState);
        this.promptTitle = [ALLNOTES, SEARCHRESULT, EMPTYNOTES, EMPTYSEARCH, ""];
        this.tags = tags;
        this.title = title;

        // 只有非提示项才设置悬停提示和标签
        if (!this.promptTitle.includes(title)) {
            this.tooltip = title;
            // 在标题后显示标签
            this.label = `${title}  ${this.formatTags()}`;
            this.iconPath = new vscode.ThemeIcon('note');
            this.command = {
                command: 'enotes.openNote',
                title: 'Open Note',
                arguments: [this]
            };
        } else {
            // 提示项只设置标签，不设置悬停提示
            this.label = title;
            this.tooltip = undefined; // 明确设置为 undefined 以移除悬停提示
        }
    }

    /**
     * 创建空选项
     * @returns {NoteItem} 空选项实例
     */
    static createEmptyItem(prompt) {
        prompt = prompt || "";
        const emptyItem = new NoteItem(prompt, [], vscode.TreeItemCollapsibleState.None);
        emptyItem.description = ''; // 清除描述
        emptyItem.contextValue = 'empty'; // 添加上下文值，用于在 package.json 中控制命令显示
        emptyItem.tooltip = undefined; // 确保移除悬停提示
        return emptyItem;
    }

    formatTags() {
        return this.tags.length ? `[${this.tags.join(', ')}]` : '';
    }

    /**
     * 获取笔记内容
     * @returns {Promise<string>} 笔记内容
     */
    async content() {
        if (this.promptTitle.includes(this.title)) return ''; // 空选项直接返回空字符串
        const noteFileUri = await getNoteUri(this.title);
        const noteContent = await vscode.workspace.fs.readFile(noteFileUri);
        return new TextDecoder().decode(noteContent);
    }
}

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
                // 检查文件是否存在
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(notePath));
                } catch (error) {
                    // 如果文件不存在，关闭对应的面板
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
                    return new NoteItem(title, tags, vscode.TreeItemCollapsibleState.None);
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
            // 检查是否已存在同名笔记
            if (this.notes.some(n => n.title === title)) {
                vscode.window.showWarningMessage(`笔记 "${title}" 已存在`);
                return;
            }

            // 获取笔记文件路径
            const noteFileUri = await getNoteUri(title);

            // 创建空文件
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(noteFileUri, encoder.encode(''));

            // 添加到笔记列表
            const note = new NoteItem(title, [], vscode.TreeItemCollapsibleState.None);
            this.notes.push(note);
            this.refresh();

            // 根据用户配置选择创建后是否自动打开笔记
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

            // 先关闭面板
            await this.panelController.closePanel(note);

            // 先删除标签记录
            try {
                await this.tagManager.deleteTag(note.title);
            } catch (tagError) {
                vscode.window.showWarningMessage(`删除笔记标签失败: ${tagError.message}`);
            }

            // 再删除文件
            try {
                await vscode.workspace.fs.delete(noteFileUri);
            } catch (fileError) {
                vscode.window.showErrorMessage(`删除笔记文件失败: ${fileError.message}`);
                return; // 如果文件删除失败，不继续后续操作
            }

            // 最后从列表中移除笔记
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

        // 检查是否已存在同名笔记
        if (this.notes.some(n => n.title === newTitle && n !== note)) {
            vscode.window.showWarningMessage(`笔记 "${newTitle}" 已存在`);
            return;
        }

        // 旧URI
        const oldUri = await getNoteUri(note.title);
        const oldTitle = note.title;

        try {
            // 新URI
            const newUri = await getNoteUri(newTitle);
            // 读取原文件内容
            const content = await vscode.workspace.fs.readFile(oldUri);
            // 写入新文件
            await vscode.workspace.fs.writeFile(newUri, content);
            // 删除原文件
            await vscode.workspace.fs.delete(oldUri);
            // 更新标签
            this.tagManager.renameTag(note.title, newTitle);
            // 更新笔记
            note.title = newTitle;
            note.label = `${note.title}  ${note.formatTags()}`;
            // 更新面板标题和标签，同时传递新文件路径
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
        // 分割并清理标签
        const newTags = tagsInput.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        // 更新笔记的标签
        note.tags = [...new Set(newTags)]; // 去重
        note.label = `${note.title}  ${note.formatTags()}`;

        // 更新标签管理器中的标签
        await this.tagManager.changeTag(note.title, note.tags);

        // 更新面板标签
        await this.panelController.updateNoteTags(note.title, note.tags);

        // 刷新左侧面板视图
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
}


/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    // 创建笔记数据提供者
    const notesProvider = new NotesProvider(context);

    // 创建并注册Webview视图提供者
    const viewProvider = new NotesViewProvider(context, notesProvider);
    notesProvider.viewProvider = viewProvider;

    // 等待初始化完成
    await notesProvider.initialize();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('enotesView', viewProvider)
    );

    // 注册刷新笔记命令
    let refreshCommand = vscode.commands.registerCommand('enotes.refreshNotes', () => {
        notesProvider.loadExistingNotes();
    });

    // 注册添加笔记命令
    let addNoteCommand = vscode.commands.registerCommand('enotes.addNote', () => {
        viewProvider.showNewNoteInput();
    });

    // 注册删除笔记命令
    let deleteNoteCommand = vscode.commands.registerCommand('enotes.deleteNote', (note) => {
        notesProvider.deleteNote(note);
    });

    // 注册打开笔记命令
    let openNoteCommand = vscode.commands.registerCommand('enotes.openNote', async (note) => {
        notesProvider.panelController.showPanel(note);
    });

    // 注册重命名笔记命令
    let renameNoteCommand = vscode.commands.registerCommand('enotes.renameNote', (note) => {
        notesProvider.renameNote(note);
    });

    // 注册修改标签命令
    let editTagsCommand = vscode.commands.registerCommand('enotes.editTags', (note) => {
        notesProvider.editTags(note);
    });

    // 注册内联编辑标签命令（从笔记面板触发）
    let editTagsInlineCommand = vscode.commands.registerCommand('enotes.editTagsInline', (noteTitle) => {
        if (viewProvider && viewProvider._view) {
            viewProvider._view.webview.postMessage({
                command: 'triggerEditTags',
                title: noteTitle
            });
        }
    });

    // 注册根据标题获取笔记对象的命令
    let getNoteByTitleCommand = vscode.commands.registerCommand('enotes.getNoteByTitle', (title) => {
        return notesProvider.getNoteByTitle(title);
    });



    // 初始化时触发一次刷新
    vscode.commands.executeCommand('enotes.refreshNotes');

    // 添加订阅
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(addNoteCommand);
    context.subscriptions.push(deleteNoteCommand);
    context.subscriptions.push(openNoteCommand);
    context.subscriptions.push(renameNoteCommand);
    context.subscriptions.push(editTagsCommand);
    context.subscriptions.push(editTagsInlineCommand);
    context.subscriptions.push(getNoteByTitleCommand);
}


// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
    activate,
    deactivate
}
