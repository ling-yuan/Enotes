const vscode = require('vscode');
const { getNotesPath } = require('../utils/config');

/**
 * 标签管理器
 */
class TagManager {
    constructor() {
        this.tags = new Map();
        this.metadata = new Map(); // 存储笔记元数据(如置顶状态)
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
                // 兼容旧格式和新格式
                if (tagsData.tags) {
                    this.tags = new Map(Object.entries(tagsData.tags));
                    this.metadata = new Map(Object.entries(tagsData.metadata || {}));
                } else {
                    this.tags = new Map(Object.entries(tagsData));
                    this.metadata = new Map();
                }
            } else {
                this.tags = new Map();
                this.metadata = new Map();
                await this.saveTags();
            }
        }
        catch (error) {
            // 如果文件不存在，创建一个空的标签文件
            this.tags = new Map();
            this.metadata = new Map();
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(tagsFileUri, encoder.encode(JSON.stringify({ tags: {}, metadata: {} }, null, 2)));
        }
    }

    /**
     * 保存标签
     * @returns {Promise<void>}
     */
    async saveTags() {
        const notesPath = await getNotesPath();
        const tagsFile = vscode.Uri.file(`${notesPath}/tags.json`);

        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(
            tagsFile,
            encoder.encode(JSON.stringify({
                tags: Object.fromEntries(this.tags),
                metadata: Object.fromEntries(this.metadata)
            }, null, 2))
        );
    }

    /**
     * 更改标签
     * @param {string} key 键
     * @param {any} value 值
     * @returns {Promise<void>}
     */
    async changeTag(key, value) {
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
     * 删除标签
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

    /**
     * 获取笔记置顶状态
     * @param {string} title 标题
     * @returns {boolean} 是否置顶
     */
    getPinned(title) {
        const meta = this.metadata.get(title);
        return meta ? meta.pinned === true : false;
    }

    /**
     * 设置笔记置顶状态
     * @param {string} title 标题
     * @param {boolean} pinned 是否置顶
     * @returns {Promise<void>}
     */
    async setPinned(title, pinned) {
        let meta = this.metadata.get(title) || {};
        meta.pinned = pinned;
        this.metadata.set(title, meta);
        await this.saveTags();
    }
}

module.exports = { TagManager };
