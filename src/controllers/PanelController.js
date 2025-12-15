const { WebviewPanelManager } = require('../webview');
const { getNoteUri } = require('../utils/config');

/**
 * 活动面板控制器
 */
class PanelController {
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

module.exports = { PanelController };
