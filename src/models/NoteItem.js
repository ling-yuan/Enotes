const vscode = require('vscode');

/**
 * 笔记列表项
 */
class NoteItem extends vscode.TreeItem {
    constructor(title, tags = [], collapsibleState) {
        super(title, collapsibleState);
        this.tags = tags;
        this.title = title;
        this.tooltip = title;
        // 在标题后显示标签
        this.label = `${title}  ${this.formatTags()}`;
        this.iconPath = new vscode.ThemeIcon('note');
        this.command = {
            command: 'enotes.openNote',
            title: 'Open Note',
            arguments: [this]
        };
    }

    formatTags() {
        return this.tags.length ? `[${this.tags.join(', ')}]` : '';
    }
}

module.exports = { NoteItem };
