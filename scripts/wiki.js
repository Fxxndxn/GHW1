let octokit;
let currentRepo = { owner: 'YOUR_USERNAME', repo: 'YOUR_REPO' };

async function login() {
    const auth = await octokit.auth({
        type: 'oauth',
        token: localStorage.getItem('github_token')
    });
    
    if (!auth.token) {
        const { data } = await octokit.request('GET /user');
        localStorage.setItem('github_token', data.token);
    }
}

async function loadPage(pageName) {
    try {
        // 安全过滤页面名称
        const safePageName = sanitizePath(pageName);
        
        // 获取Markdown内容
        const { data: contentData } = await octokit.rest.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: `wiki/${safePageName}.md`
        });

        // 解码并处理内容
        const content = atob(contentData.content);
        const processedContent = processMarkdownContent(content);
        const htmlContent = marked.parse(processedContent);

        // 更新页面内容
        document.getElementById('dynamic-content').innerHTML = htmlContent;
        window.history.replaceState({}, '', `?page=${safePageName}`);

    } catch (error) {
        handleContentError(error);
    }
}

function sanitizePath(path) {
    return path.replace(/[^a-zA-Z0-9-_/]/g, '').replace(/\.\./g, '');
}

function processMarkdownContent(content) {
    // 转换资源路径
    return content.replace(/\!\[(.*?)\]\((.*?)\)/g, (match, alt, path) => {
        const safePath = sanitizePath(path);
        return `![${alt}](/wiki/resources/${safePath})`;
    });
}

function applyTemplate(content) {
    return `
        <header>Wiki Header</header>
        ${marked.parse(content)}
        <footer>Wiki Footer</footer>
    `;
}

async function savePage() {
    const content = document.getElementById('editor').value;
    await octokit.repos.createOrUpdateFileContents({
        ...currentRepo,
        path: `wiki/${pageName}.md`,
        message: 'Update wiki page',
        content: btoa(content),
        sha: currentSha
    });
}

async function uploadResource(file) {
    try {
        const content = await readFileAsBase64(file);
        
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: `wiki/resources/${file.name}`,
            message: `Add resource: ${file.name}`,
            content: btoa(content),
            sha: await getFileSha(`wiki/resources/${file.name}`)
        });
        
        return true;
    } catch (error) {
        console.error('Upload failed:', error);
        return false;
    }
}

async function getFileSha(path) {
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path
        });
        return data.sha;
    } catch {
        return null;
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 新增页面参数处理函数
function navigateToPage(pageName) {
    loadPage(pageName);
} 

// 资源管理器功能
async function toggleResourceManager() {
    const panel = document.getElementById('resourceList');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    
    if (panel.style.display === 'block') {
        const res = await octokit.repos.getContent({
            owner: 'YOUR_USERNAME',
            repo: REPO_NAME,
            path: 'resources'
        });
        
        const list = res.data.map(file => 
            `<li>${file.name} <button onclick="insertResource('${file.name}')">插入</button></li>`
        ).join('');
        
        document.getElementById('resourceItems').innerHTML = list;
    }
}

// 插入资源到编辑器
function insertResource(filename) {
    const mdLink = `![${filename}](${RESOURCE_BASE}${encodeURIComponent(filename)})`;
    const editor = document.getElementById('editor');
    editor.value += `\n${mdLink}\n`;
}
