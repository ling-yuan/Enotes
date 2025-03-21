const vscode = require('vscode');
const fs = require('fs');
const marked = require('marked');
const katex = require('katex');

const renderer = {
    text(token) {
        const text = token.text || "";
        if (text.match(/\$([^\$]+)\$/g)) {
            return text.replace(/\$([^\$]+)\$/g, (_, formula) => {
                try {
                    return katex.renderToString(formula, { displayMode: false, output: 'mathml' });
                } catch (error) {
                    console.error('行内公式渲染错误:', error);
                    return `$${formula}$`;
                }
            });
        }
        return false; // 回退默认处理
    },
    // eslint-disable-next-line no-unused-vars
    paragraph({ tokens, text, raw }) {
        if (text.match(/\$\$([\s\S]+?)\$\$/g)) {
            return text.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) => {
                try {
                    return katex.renderToString(formula, { displayMode: true, output: 'mathml' });
                } catch (error) {
                    console.error('块级公式渲染错误:', error);
                    return `$$${formula}$$`;
                }
            });
        }
        return false; // 回退默认处理
    }
};

marked.setOptions({
    gfm: true,           // 启用 GitHub 风格的 Markdown
    breaks: true,        // 启用换行符
    headerIds: true,     // 为标题添加 id
    mangle: false,       // 不转义标题中的特殊字符
    smartLists: true,    // 使用更智能的列表行为
    smartypants: true,   // 使用更智能的标点符号
    xhtml: true,         // 使用 xhtml 规范的标签
    emoji: true,         // 启用 emoji 支持
}).use({ renderer });

/**
 * Webview 内容管理器
 */
class WebviewContentProvider {
    constructor(context) {
        this.context = context;
    }

    /**
     * 获取 HTML 内容
     * @param {vscode.Webview} webview webview实例
     * @returns {string} HTML内容
     */
    getHtmlContent(webview) {
        const templatePath = this.context.asAbsolutePath('src/views/template.html');
        let html = fs.readFileSync(templatePath, 'utf-8');

        // 定义需要加载的资源文件
        const resources = {
            styles: [
                'src/lib/codemirror.min.css',
                'src/views/markdown.css',
                'node_modules/katex/dist/katex.min.css' // 添加 KaTeX CSS
            ],
            scripts: [
                'src/lib/codemirror.min.js',
                'src/lib/markdown.min.js',
                'src/lib/xml.min.js',
                'src/lib/javascript.min.js',
                'src/lib/css.min.js',
                'node_modules/katex/dist/katex.min.js' // 添加 KaTeX JS
            ]
        };

        // 生成资源URI和HTML标签
        let resourceTags = '';

        // 处理样式文件
        resourceTags += resources.styles.map(style => {
            const uri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, style));
            return `<link rel="stylesheet" href="${uri}">`;
        }).join('\n');

        // 处理脚本文件
        resourceTags += resources.scripts.map(script => {
            const uri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, script));
            return `<script src="${uri}"></script>`;
        }).join('\n');

        // 注入所有资源
        html = html.replace('<!--localfile-->', resourceTags);

        return html;
    }
}

/**
 * Webview 面板管理器
 */
class WebviewPanelManager {
    constructor(context) {
        this.context = context;
        this.panels = new Map();
        this.notePaths = new Map(); // 添加一个Map来存储笔记标题和文件路径的映射
        this.contentProvider = new WebviewContentProvider(context);

        // 注册预览切换命令
        context.subscriptions.push(
            vscode.commands.registerCommand('enotes.togglePreview', () => {
                const activePanel = Array.from(this.panels.values())
                    .find(panel => panel.active);
                if (activePanel) {
                    activePanel.webview.postMessage({ type: 'togglePreview' });
                }
            })
        );
    }

    /**
     * 创建或显示面板
     * @param {string} noteTitle 笔记标题
     * @param {string} notePath 笔记文件路径
     * @param {string[]} tags 笔记标签
     * @returns {vscode.WebviewPanel} webview面板
     */
    async createOrShow(noteTitle, notePath, tags = []) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;

        // 如果面板已存在，则显示
        if (this.panels.has(noteTitle)) {
            const panel = this.panels.get(noteTitle);
            panel.reveal(column);
            // 更新标签
            panel.webview.postMessage({ type: 'update', tags });
            return;
        }

        // 获取默认模式设置
        const defaultEditMode = vscode.workspace.getConfiguration('enotes').get('defaultEditMode');

        // 创建新面板
        const panel = vscode.window.createWebviewPanel(
            'enotesEditor',
            `Note: ${noteTitle}`,
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'src')
                ]
            }
        );

        // 获取图标的绝对路径 并 设置图标
        panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icon_notepanel.svg');

        // 设置HTML内容
        panel.webview.html = this.contentProvider.getHtmlContent(panel.webview);

        // 保存笔记路径
        this.notePaths.set(noteTitle, notePath);

        // 读取笔记内容
        try {
            const content = fs.readFileSync(notePath, 'utf-8');
            // 更新webview内容和标签
            panel.webview.postMessage({
                type: 'update',
                noteTitle,
                content,
                tags,
                defaultEditMode // 传递默认模式设置
            });
        } catch (error) {
            vscode.window.showErrorMessage(`读取笔记失败: ${error.message}`);
        }

        // 处理webview消息
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'save':
                        try {
                            // 使用当前标题对应的文件路径
                            const currentPath = this.notePaths.get(message.noteTitle);
                            if (currentPath) {
                                fs.writeFileSync(currentPath, message.content, 'utf-8');
                            } else {
                                throw new Error('找不到笔记文件路径');
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`保存笔记失败: ${error.message}`);
                        }
                        break;
                    case 'getPreview':
                        try {
                            // 使用 marked 将 Markdown 转换为 HTML
                            const html = marked.parse(message.content);
                            panel.webview.postMessage({
                                type: 'preview',
                                html: html
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`生成预览失败: ${error.message}`);
                        }
                        break;
                    case 'editTags':
                        // 触发修改标签命令
                        if (message.noteTitle) {
                            // 在笔记列表中查找对应的笔记项
                            vscode.commands.executeCommand('enotes.getNoteByTitle', message.noteTitle)
                                .then(note => {
                                    if (note) {
                                        vscode.commands.executeCommand('enotes.editTags', note);
                                    } else {
                                        // 如果找不到笔记，创建一个临时的笔记对象
                                        vscode.commands.executeCommand('enotes.editTags', {
                                            title: message.noteTitle,
                                            tags: []
                                        });
                                    }
                                })
                                .catch(error => {
                                    vscode.window.showErrorMessage(`获取笔记失败: ${error.message}`);
                                });
                        }
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // 处理面板关闭
        panel.onDidDispose(
            () => {
                this.panels.delete(noteTitle);
                this.notePaths.delete(noteTitle); // 清理路径映射
            },
            null,
            this.context.subscriptions
        );

        this.panels.set(noteTitle, panel);
    }

    /**
     * 关闭指定标题的面板
     * @param {string} noteTitle 笔记标题
     * @returns {Promise<boolean>} 是否成功关闭面板
     */
    async closePanel(noteTitle) {
        const panel = this.panels.get(noteTitle);
        if (panel) {
            panel.dispose();
            this.panels.delete(noteTitle);
            this.notePaths.delete(noteTitle); // 清理路径映射
            return true;
        }
        return false;
    }

    /**
     * 更新笔记标题
     * @param {string} oldTitle 旧标题
     * @param {string} newTitle 新标题
     * @param {string[]} tags 标签数组
     * @param {string} newPath 新文件路径
     */
    async updateNoteTitle(oldTitle, newTitle, tags = [], newPath) {
        const panel = this.panels.get(oldTitle);
        if (panel) {
            // 更新面板标题
            panel.title = `Note: ${newTitle}`;
            // 更新面板映射
            this.panels.delete(oldTitle);
            this.panels.set(newTitle, panel);
            // 更新文件路径映射
            this.notePaths.delete(oldTitle);
            this.notePaths.set(newTitle, newPath);
            // 通知 webview 更新标签，但保持内容不变
            panel.webview.postMessage({
                type: 'update',
                noteTitle: newTitle,
                tags: tags,
                keepContent: true
            });
        }
    }

    /**
     * 更新笔记标签
     * @param {string} noteTitle 笔记标题
     * @param {string[]} tags 新标签数组
     */
    async updateNoteTags(noteTitle, tags = []) {
        const panel = this.panels.get(noteTitle);
        if (panel) {
            // 确保面板处于活动状态
            panel.reveal();

            // 发送更新消息到webview
            panel.webview.postMessage({
                type: 'update',
                tags: tags,
                keepContent: true // 添加标志以保持内容不变
            });
        }
    }
}

module.exports = {
    WebviewPanelManager
}; 