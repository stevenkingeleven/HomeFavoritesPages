// 默认收藏夹数据
const defaultFavoritesData = [
    {
        "type": "folder",
        "name": "常用",
        "description": "日常最常访问的网站和工具",
        "children": [
            {"type": "link", "name": "Canva", "url": "https://www.canva.com/", "description": "在线图形设计平台"},
            {"type": "link", "name": "Gemini", "url": "https://gemini.google.com/app?hl=ja", "description": "Google AI 对话助手"},
            {"type": "link", "name": "Claude", "url": "https://claude.ai/new", "description": "Anthropic AI 助手"}
        ]
    }
];

// 全局变量
let favoritesData = [];
let currentPath = [];
let tooltip = null;
let urlPreview = null;
let searchKeyword = '';
let draggedIndex = null;
let draggedElement = null;
let draggedItem = null;  // 存储被拖动的完整数据
let selectedIndices = new Set();  // 存储选中的项目索引
let isSelecting = false;  // 是否正在框选
let selectionBox = null;  // 选择框元素
let selectionStart = { x: 0, y: 0 };  // 框选起始位置
let isCtrlPressed = false;  // Ctrl 键是否按下
let dropIndicator = null;  // 拖拽位置指示器
let insertIndex = -1;  // 插入位置索引

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    tooltip = document.getElementById('tooltip');
    urlPreview = document.getElementById('urlPreview');
    loadData();
    initSearchBox();
    initToolbar();
    initMultiSelection();
    renderItems();
});

// 从 LocalStorage 加载数据
function loadData() {
    const saved = localStorage.getItem('favoritesData');
    if (saved) {
        try {
            favoritesData = JSON.parse(saved);
        } catch (e) {
            console.error('加载数据失败:', e);
            favoritesData = JSON.parse(JSON.stringify(defaultFavoritesData));
        }
    } else {
        favoritesData = JSON.parse(JSON.stringify(defaultFavoritesData));
    }
}

// 保存数据到 LocalStorage
function saveData() {
    try {
        localStorage.setItem('favoritesData', JSON.stringify(favoritesData));
        return true;
    } catch (e) {
        console.error('保存数据失败:', e);
        alert('保存に失敗しました：' + e.message);
        return false;
    }
}

// 初始化工具栏
function initToolbar() {
    document.getElementById('addItemBtn').addEventListener('click', () => showAddDialog());
    document.getElementById('exportBtn').addEventListener('click', () => exportData());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', (e) => importData(e));
}

// 初始化搜索框
function initSearchBox() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', (e) => {
        searchKeyword = e.target.value.trim();
        clearButton.style.display = searchKeyword ? 'flex' : 'none';
        renderItems();
    });
    
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        searchKeyword = '';
        clearButton.style.display = 'none';
        renderItems();
        searchInput.focus();
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchKeyword = '';
            clearButton.style.display = 'none';
            renderItems();
        }
    });
}

// 初始化多选功能
function initMultiSelection() {
    const container = document.querySelector('.container');
    const grid = document.getElementById('itemsGrid');
    
    // 监听 Ctrl/Cmd 键
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            isCtrlPressed = true;
        }
        
        // Ctrl+A 全选
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !searchKeyword) {
            e.preventDefault();
            selectAll();
        }
        
        // Escape 取消选择
        if (e.key === 'Escape') {
            clearSelection();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (!e.ctrlKey && !e.metaKey) {
            isCtrlPressed = false;
        }
    });
    
    // 框选功能
    grid.addEventListener('mousedown', (e) => {
        // 如果点击的是项目，不启动框选
        if (e.target.closest('.item')) {
            return;
        }
        
        // 如果在搜索模式下，禁用框选
        if (searchKeyword) {
            return;
        }
        
        // 如果不是左键，返回
        if (e.button !== 0) {
            return;
        }
        
        // 如果没按 Ctrl，清除之前的选择
        if (!isCtrlPressed) {
            clearSelection();
        }
        
        isSelecting = true;
        selectionStart = {
            x: e.clientX + grid.scrollLeft,
            y: e.clientY + grid.scrollTop
        };
        
        // 创建选择框
        if (!selectionBox) {
            selectionBox = document.createElement('div');
            selectionBox.className = 'selection-box';
            grid.appendChild(selectionBox);
        }
        
        selectionBox.style.left = e.clientX + 'px';
        selectionBox.style.top = e.clientY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        
        const currentX = e.clientX + grid.scrollLeft;
        const currentY = e.clientY + grid.scrollTop;
        
        const left = Math.min(selectionStart.x, currentX);
        const top = Math.min(selectionStart.y, currentY);
        const width = Math.abs(currentX - selectionStart.x);
        const height = Math.abs(currentY - selectionStart.y);
        
        selectionBox.style.left = (left - grid.scrollLeft) + 'px';
        selectionBox.style.top = (top - grid.scrollTop) + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        
        // 检测与项目的交集
        updateSelectionByBox(left, top, width, height);
    });
    
    document.addEventListener('mouseup', () => {
        if (isSelecting) {
            isSelecting = false;
            if (selectionBox) {
                selectionBox.style.display = 'none';
            }
        }
    });
}

// 根据选择框更新选中项
function updateSelectionByBox(left, top, width, height) {
    const items = document.querySelectorAll('.item');
    const selectionRect = {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height
    };
    
    items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const grid = document.getElementById('itemsGrid');
        const itemRect = {
            left: rect.left + grid.scrollLeft,
            top: rect.top + grid.scrollTop,
            right: rect.right + grid.scrollLeft,
            bottom: rect.bottom + grid.scrollTop
        };
        
        // 检测矩形相交
        const intersects = !(
            itemRect.right < selectionRect.left ||
            itemRect.left > selectionRect.right ||
            itemRect.bottom < selectionRect.top ||
            itemRect.top > selectionRect.bottom
        );
        
        if (intersects) {
            addToSelection(index);
        } else if (!isCtrlPressed) {
            removeFromSelection(index);
        }
    });
}

// 添加到选择
function addToSelection(index) {
    selectedIndices.add(index);
    updateItemSelection(index, true);
    updateSelectionBar();
}

// 从选择中移除
function removeFromSelection(index) {
    selectedIndices.delete(index);
    updateItemSelection(index, false);
    updateSelectionBar();
}

// 更新项目的选中状态
function updateItemSelection(index, isSelected) {
    const items = document.querySelectorAll('.item');
    if (items[index]) {
        if (isSelected) {
            items[index].classList.add('selected');
        } else {
            items[index].classList.remove('selected');
        }
    }
}

// 清除所有选择
function clearSelection() {
    selectedIndices.clear();
    document.querySelectorAll('.item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    updateSelectionBar();
}

// 更新选择栏
function updateSelectionBar() {
    const selectionBar = document.getElementById('selectionBar');
    const selectionCount = document.getElementById('selectionCount');
    
    if (selectedIndices.size > 0) {
        selectionBar.style.display = 'flex';
        selectionCount.textContent = `${selectedIndices.size}件選択中`;
    } else {
        selectionBar.style.display = 'none';
    }
}

// 删除选中的项目
function deleteSelectedItems() {
    if (selectedIndices.size === 0) return;
    
    const count = selectedIndices.size;
    if (!confirm(`選択した${count}件を削除してもよろしいですか？この操作は元に戻せません。`)) {
        return;
    }
    
    const items = getCurrentItemsRef();
    
    // 按索引倒序排序，从后往前删除
    const sortedIndices = Array.from(selectedIndices).sort((a, b) => b - a);
    sortedIndices.forEach(index => {
        items.splice(index, 1);
    });
    
    clearSelection();
    saveData();
    renderItems();
    
    showTemporaryMessage(`${count}件削除しました`);
}

// 全选
function selectAll() {
    const items = getCurrentItems();
    items.forEach((item, index) => {
        addToSelection(index);
    });
}

// 切换项目选择状态（Ctrl+点击）
function toggleItemSelection(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    if (selectedIndices.has(index)) {
        removeFromSelection(index);
    } else {
        addToSelection(index);
    }
}

// 显示添加对话框
function showAddDialog() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = '新規項目を追加';
    modalBody.innerHTML = `
        <div class="form-group">
            <label>タイプ</label>
            <select id="itemType" onchange="updateAddForm()">
                <option value="link">Webサイトリンク</option>
                <option value="folder">フォルダ</option>
            </select>
        </div>
        <div id="dynamicForm"></div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="addItem()">追加</button>
        </div>
    `;
    
    updateAddForm();
    modal.classList.add('show');
}

// 更新添加表单
function updateAddForm() {
    const type = document.getElementById('itemType').value;
    const dynamicForm = document.getElementById('dynamicForm');
    
    if (type === 'link') {
        dynamicForm.innerHTML = `
            <div class="form-group">
                <label>名前 *</label>
                <input type="text" id="itemName" placeholder="例：GitHub" required>
            </div>
            <div class="form-group">
                <label>URL *</label>
                <input type="url" id="itemUrl" placeholder="https://example.com" required>
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea id="itemDesc" placeholder="Webサイトの説明（任意）"></textarea>
            </div>
            <div class="form-group">
                <label>アイコンURL</label>
                <input type="url" id="itemIcon" placeholder="https://example.com/icon.png（任意）">
            </div>
        `;
    } else {
        dynamicForm.innerHTML = `
            <div class="form-group">
                <label>フォルダ名 *</label>
                <input type="text" id="itemName" placeholder="例：よく使うツール" required>
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea id="itemDesc" placeholder="フォルダの説明（任意）"></textarea>
            </div>
        `;
    }
}

// 添加项目
function addItem() {
    const type = document.getElementById('itemType').value;
    const name = document.getElementById('itemName').value.trim();
    const desc = document.getElementById('itemDesc').value.trim();
    
    if (!name) {
        alert('名前を入力してください');
        return;
    }
    
    const newItem = {
        type: type,
        name: name,
        description: desc || undefined
    };
    
    if (type === 'link') {
        const url = document.getElementById('itemUrl').value.trim();
        const icon = document.getElementById('itemIcon').value.trim();
        
        if (!url) {
            alert('URLを入力してください');
            return;
        }
        
        newItem.url = url;
        if (icon) newItem.icon = icon;
    } else {
        newItem.children = [];
    }
    
    const items = getCurrentItemsRef();
    items.push(newItem);
    
    saveData();
    closeModal();
    renderItems();
}

// 显示编辑对话框
function showEditDialog(index) {
    const items = searchKeyword ? searchAllItems(favoritesData, searchKeyword) : getCurrentItems();
    const item = items[index];
    
    if (!item) return;
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = '項目を編集';
    
    if (item.type === 'link') {
        modalBody.innerHTML = `
            <div class="form-group">
                <label>名前 *</label>
                <input type="text" id="editName" value="${escapeHtml(item.name)}" required>
            </div>
            <div class="form-group">
                <label>URL *</label>
                <input type="url" id="editUrl" value="${escapeHtml(item.url)}" required>
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea id="editDesc">${escapeHtml(item.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>アイコンURL</label>
                <input type="url" id="editIcon" value="${escapeHtml(item.icon || '')}">
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
                <button class="btn btn-primary" onclick="saveEdit(${index})">保存</button>
            </div>
        `;
    } else {
        modalBody.innerHTML = `
            <div class="form-group">
                <label>フォルダ名 *</label>
                <input type="text" id="editName" value="${escapeHtml(item.name)}" required>
            </div>
            <div class="form-group">
                <label>説明</label>
                <textarea id="editDesc">${escapeHtml(item.description || '')}</textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
                <button class="btn btn-primary" onclick="saveEdit(${index})">保存</button>
            </div>
        `;
    }
    
    modal.classList.add('show');
}

// 保存编辑
function saveEdit(index) {
    const name = document.getElementById('editName').value.trim();
    const desc = document.getElementById('editDesc').value.trim();
    
    if (!name) {
        alert('名前を入力してください');
        return;
    }
    
    const items = searchKeyword ? null : getCurrentItemsRef();
    const item = searchKeyword ? searchAllItems(favoritesData, searchKeyword)[index] : items[index];
    
    if (!item) return;
    
    item.name = name;
    item.description = desc || undefined;
    
    if (item.type === 'link') {
        const url = document.getElementById('editUrl').value.trim();
        const icon = document.getElementById('editIcon').value.trim();
        
        if (!url) {
            alert('URLを入力してください');
            return;
        }
        
        item.url = url;
        item.icon = icon || undefined;
    }
    
    saveData();
    closeModal();
    renderItems();
}

// 显示删除确认对话框
function showDeleteDialog(index) {
    const items = searchKeyword ? searchAllItems(favoritesData, searchKeyword) : getCurrentItems();
    const item = items[index];
    
    if (!item) return;
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = '削除の確認';
    modalBody.innerHTML = `
        <div class="confirm-dialog">
            <div class="confirm-icon">⚠️</div>
            <div class="confirm-message">「${escapeHtml(item.name)}」を削除してもよろしいですか？</div>
            <div class="confirm-submessage">${item.type === 'folder' ? 'フォルダ内のすべての内容も削除されます' : 'この操作は元に戻せません'}</div>
            <div class="form-actions" style="justify-content: center;">
                <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
                <button class="btn btn-primary" style="background: #e74c3c;" onclick="deleteItem(${index})">削除</button>
            </div>
        </div>
    `;
    
    modal.classList.add('show');
}

// 删除项目
function deleteItem(index) {
    const items = getCurrentItemsRef();
    items.splice(index, 1);
    
    saveData();
    closeModal();
    renderItems();
}

// 关闭模态框
function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

// 导出数据
function exportData() {
    const dataStr = JSON.stringify(favoritesData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `favorites-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// 导入数据
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                favoritesData = data;
                saveData();
                currentPath = [];
                searchKeyword = '';
                renderItems();
                alert('インポートに成功しました！');
            } else {
                alert('無効なデータ形式です');
            }
        } catch (error) {
            alert('インポートに失敗しました：' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// 获取当前路径下的项目（返回引用，可修改）
function getCurrentItemsRef() {
    let items = favoritesData;
    for (const folderName of currentPath) {
        const folder = items.find(item => item.type === 'folder' && item.name === folderName);
        if (folder && folder.children) {
            items = folder.children;
        } else {
            return [];
        }
    }
    return items;
}

// 获取当前路径下的项目(返回副本,只读)
// クリックカウント順にソートされたアイテムを返す
function getCurrentItems() {
    const items = getCurrentItemsRef();
    
    // アイテムに元のインデックスを保持
    const itemsWithOriginalIndex = items.map((item, index) => ({
        ...item,
        _originalIndex: index
    }));
    
    // アイテムをコピーしてソート
    const sortedItems = itemsWithOriginalIndex.sort((a, b) => {
        // フォルダは常に上に
        if (a.type === 'folder' && b.type === 'link') return -1;
        if (a.type === 'link' && b.type === 'folder') return 1;
        
        // 両方リンクの場合、クリックカウントでソート(降順)
        if (a.type === 'link' && b.type === 'link') {
            const countA = a.clickCount || 0;
            const countB = b.clickCount || 0;
            return countB - countA; // 高い順
        }
        
        // フォルダ同士はそのまま
        return 0;
    });
    
    return sortedItems;
}

// 搜索所有项目
function searchAllItems(items, keyword) {
    const results = [];
    const lowerKeyword = keyword.toLowerCase();
    
    function searchRecursive(items, path = []) {
        items.forEach(item => {
            if (item.type === 'link') {
                const nameMatch = item.name.toLowerCase().includes(lowerKeyword);
                const urlMatch = item.url.toLowerCase().includes(lowerKeyword);
                const descMatch = item.description && item.description.toLowerCase().includes(lowerKeyword);
                
                if (nameMatch || urlMatch || descMatch) {
                    results.push({ ...item, path: path.join(' > ') });
                }
            } else if (item.type === 'folder') {
                const nameMatch = item.name.toLowerCase().includes(lowerKeyword);
                const descMatch = item.description && item.description.toLowerCase().includes(lowerKeyword);
                
                if (nameMatch || descMatch) {
                    results.push({ ...item, path: path.join(' > ') });
                }
                
                if (item.children) {
                    searchRecursive(item.children, [...path, item.name]);
                }
            }
        });
    }
    
    searchRecursive(items);
    return results;
}

// 渲染项目
function renderItems() {
    const grid = document.getElementById('itemsGrid');
    
    if (searchKeyword) {
        renderSearchResults(grid);
        return;
    }
    
    const items = getCurrentItems();
    
    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <div class="empty-state-text">此文件夹为空</div>
            </div>
        `;
        updateBreadcrumb();
        return;
    }
    
    let html = '';
    
    if (currentPath.length > 0) {
        html += `
            <div class="drop-zone-wrapper">
                <div class="back-btn back-button" onclick="goBack()" title="項目をここにドラッグして上の階層に移動">
                    <span class="back-arrow">←</span>
                    <span class="back-text">前のレベルに戻る</span>
                    <span class="drop-hint">（項目をここにドロップできます）</span>
                </div>
            </div>
        `;
    }
    
    items.forEach((item, displayIndex) => {
        const originalIndex = item._originalIndex !== undefined ? item._originalIndex : displayIndex;
        if (item.type === 'folder') {
            html += createFolderHTML(item, originalIndex);
        } else if (item.type === 'link') {
            html += createLinkHTML(item, originalIndex);
        }
    });
    
    grid.innerHTML = html;
    updateBreadcrumb();
    attachEventListeners();
}

// 渲染搜索结果
function renderSearchResults(grid) {
    const results = searchAllItems(favoritesData, searchKeyword);
    
    if (results.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">一致する結果が見つかりませんでした</div>
            </div>
        `;
        return;
    }
    
    let html = `<div class="search-results-info">${results.length}件の一致する結果が見つかりました</div>`;
    
    results.forEach((item, index) => {
        if (item.type === 'folder') {
            html += createFolderHTML(item, index, true);
        } else if (item.type === 'link') {
            html += createLinkHTML(item, index, true);
        }
    });
    
    grid.innerHTML = html;
    updateBreadcrumb();
    attachEventListeners();
}

// 创建文件夹 HTML
function createFolderHTML(folder, index, isSearchResult = false) {
    const pathInfo = isSearchResult && folder.path ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">${folder.path}</div>` : '';
    const selectedClass = selectedIndices.has(index) ? 'selected' : '';
    return `
        <div class="item ${selectedClass}" 
             draggable="true" 
             data-index="${index}"
             onclick="handleItemClick(event, ${index}, 'folder', '${escapeHtml(folder.name)}')" 
             onmouseenter="showTooltip(event, ${index})" 
             onmouseleave="hideTooltip()">
            <div class="selection-checkbox ${selectedClass ? 'visible' : ''}">
                <span class="checkbox-icon">✓</span>
            </div>
            <div class="item-actions">
                <button class="item-action-btn edit" onclick="event.stopPropagation(); showEditDialog(${index})" title="编辑">✏️</button>
                <button class="item-action-btn delete" onclick="event.stopPropagation(); showDeleteDialog(${index})" title="删除">🗑️</button>
            </div>
            <div class="folder-icon">📁</div>
            <div class="item-name">${escapeHtml(folder.name)}${pathInfo}</div>
        </div>
    `;
}

// 创建链接 HTML
function createLinkHTML(link, index, isSearchResult = false) {
    const favicon = link.icon || getFaviconUrl(link.url);
    const pathInfo = isSearchResult && link.path ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">${link.path}</div>` : '';
    const selectedClass = selectedIndices.has(index) ? 'selected' : '';
    const clickCount = link.clickCount || 0;
    
    return `
        <div class="item ${selectedClass}" 
             draggable="true" 
             data-index="${index}"
             onclick="handleItemClick(event, ${index}, 'link', '${escapeHtml(link.url)}')" 
             onmouseenter="showTooltipAndUrl(event, ${index}, '${escapeHtml(link.url)}')" 
             onmouseleave="hideTooltipAndUrl()">
            <div class="selection-checkbox ${selectedClass ? 'visible' : ''}">
                <span class="checkbox-icon">✓</span>
            </div>
            <div class="item-actions">
                <button class="item-action-btn edit" onclick="event.stopPropagation(); showEditDialog(${index})" title="编辑">✏️</button>
                <button class="item-action-btn delete" onclick="event.stopPropagation(); showDeleteDialog(${index})" title="删除">🗑️</button>
            </div>
            ${clickCount > 0 ? `<div class="click-count" title="クリック回数">${clickCount}</div>` : ''}
            <div class="link-icon">
                ${favicon ? `<img src="${escapeHtml(favicon)}" alt="${escapeHtml(link.name)}" onerror="this.parentElement.innerHTML='<span class=\\'default-icon\\'>🔗</span>'">` : '<span class="default-icon">🔗</span>'}
            </div>
            <div class="item-name">${escapeHtml(link.name)}${pathInfo}</div>
        </div>
    `;
}

// 处理项目点击
function handleItemClick(event, index, type, target) {
    // 如果按住 Ctrl/Cmd，切换选择状态
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        toggleItemSelection(index, event);
        return;
    }
    
    // 如果有选中的项目,点击非选中项时清除选择
    if (selectedIndices.size > 0 && !selectedIndices.has(index)) {
        clearSelection();
    }
    
    // 正常点击行为
    if (type === 'folder') {
        // 如果在搜索模式下，需要找到该文件夹的完整路径并导航到它
        if (searchKeyword) {
            const results = searchAllItems(favoritesData, searchKeyword);
            const folder = results[index];
            if (folder && folder.path) {
                // 清除搜索
                document.getElementById('searchInput').value = '';
                searchKeyword = '';
                document.getElementById('clearSearch').style.display = 'none';
                
                // 导航到文件夹路径
                const pathParts = folder.path.split(' > ').filter(p => p);
                pathParts.push(folder.name);
                currentPath = pathParts;
                renderItems();
            } else {
                // 如果没有路径信息，说明是在根目录
                document.getElementById('searchInput').value = '';
                searchKeyword = '';
                document.getElementById('clearSearch').style.display = 'none';
                currentPath = [folder.name];
                renderItems();
            }
        } else {
            openFolder(target);
        }
    } else {
        openLink(target, index);
    }
}

function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    } catch {
        return null;
    }
}

function openFolder(folderName) {
    currentPath.push(folderName);
    renderItems();
}

function goBack() {
    if (currentPath.length > 0) {
        currentPath.pop();
        renderItems();
    }
}

function openLink(url, index) {
    console.log('openLink called:', { url, index });
    
    // 新しいタブでURLを開く(ポップアップブロッカー対策のため、カウント前に実行)
    console.log('Opening URL in new tab:', url);
    window.open(url, '_blank');
    
    // カウンターを増やす
    if (index !== undefined) {
        incrementClickCount(index);
    }
}

// クリックカウントを増やす
function incrementClickCount(index) {
    console.log('incrementClickCount called with original index:', index);
    const items = getCurrentItemsRef();
    
    // indexは_originalIndexを使って渡されているので、そのまま使える
    const item = items[index];
    
    console.log('Item found:', item);
    
    // リンクのみカウント
    if (item && item.type === 'link') {
        const oldCount = item.clickCount || 0;
        item.clickCount = oldCount + 1;
        console.log('Click count updated:', oldCount, '->', item.clickCount);
        saveData(); // LocalStorageに保存
        
        // 再レンダリングを遅延実行(window.openを妨げないため)
        setTimeout(() => {
            renderItems();
        }, 100);
    } else {
        console.warn('Item is not a link or not found:', item);
    }
}

// クリックカウント表示を更新
function updateClickCountDisplay(index, count) {
    const itemElement = document.querySelector(`[data-index="${index}"] .click-count`);
    if (itemElement) {
        itemElement.textContent = count;
        // アニメーション効果
        itemElement.classList.add('count-updated');
        setTimeout(() => {
            itemElement.classList.remove('count-updated');
        }, 300);
    }
}

function updateBreadcrumb() {
    const breadcrumb = document.querySelector('.breadcrumb');
    let html = '<span class="breadcrumb-item breadcrumb-drop-target" data-path-index="-1" onclick="navigateToPath(-1)">ホーム</span>';
    
    currentPath.forEach((folderName, index) => {
        html += `<span class="breadcrumb-item breadcrumb-drop-target" data-path-index="${index}" onclick="navigateToPath(${index})">${escapeHtml(folderName)}</span>`;
    });
    
    breadcrumb.innerHTML = html;
    
    const items = breadcrumb.querySelectorAll('.breadcrumb-item');
    items.forEach((item, index) => {
        if (index === items.length - 1) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // 为面包屑项添加拖放事件监听器
    attachBreadcrumbDragListeners();
}

function navigateToPath(index) {
    if (index === -1) {
        currentPath = [];
    } else {
        currentPath = currentPath.slice(0, index + 1);
    }
    renderItems();
}

function showTooltipAndUrl(event, index, url) {
    let item;
    if (searchKeyword) {
        const results = searchAllItems(favoritesData, searchKeyword);
        item = results[index];
    } else {
        const items = getCurrentItems();
        item = items[index];
    }
    
    if (item && item.description) {
        const tooltipContent = tooltip.querySelector('.tooltip-content');
        tooltipContent.textContent = item.description;
        tooltip.classList.add('show');
        updateTooltipPosition(event);
    }
    
    if (item && item.type === 'link' && url) {
        showUrlPreview(url);
    }
}

function hideTooltipAndUrl() {
    hideTooltip();
    hideUrlPreview();
}

function showUrlPreview(url) {
    const urlText = urlPreview.querySelector('.url-text');
    urlText.textContent = decodeURIComponent(url);
    urlPreview.classList.add('show');
}

function hideUrlPreview() {
    urlPreview.classList.remove('show');
}

function showTooltip(event, index) {
    let item;
    if (searchKeyword) {
        const results = searchAllItems(favoritesData, searchKeyword);
        item = results[index];
    } else {
        const items = getCurrentItems();
        item = items[index];
    }
    
    if (!item || !item.description) {
        return;
    }
    
    const tooltipContent = tooltip.querySelector('.tooltip-content');
    tooltipContent.textContent = item.description;
    
    tooltip.classList.add('show');
    updateTooltipPosition(event);
}

function hideTooltip() {
    tooltip.classList.remove('show');
}

function updateTooltipPosition(event) {
    const x = event.clientX;
    const y = event.clientY;
    const offset = 15;
    
    tooltip.style.left = (x + offset) + 'px';
    tooltip.style.top = (y + offset) + 'px';
}

function attachEventListeners() {
    const grid = document.getElementById('itemsGrid');
    const items = document.querySelectorAll('.item');
    
    items.forEach(item => {
        item.addEventListener('mousemove', updateTooltipPosition);
        
        // 添加拖拽事件监听器
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('drop', handleDrop);
    });
    
    // 为网格添加拖拽事件监听器
    grid.addEventListener('dragover', handleDragOver);
    grid.addEventListener('dragleave', handleDragLeave);
    
    // 为返回按钮添加拖拽目标事件
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('dragover', handleBackBtnDragOver);
        backBtn.addEventListener('drop', handleBackBtnDrop);
        backBtn.addEventListener('dragleave', handleBackBtnDragLeave);
    }
}

// 为面包屑添加拖放事件监听器
function attachBreadcrumbDragListeners() {
    const breadcrumbItems = document.querySelectorAll('.breadcrumb-drop-target');
    breadcrumbItems.forEach(item => {
        // 排除当前活动的面包屑项（不能拖到当前位置）
        if (!item.classList.contains('active')) {
            item.addEventListener('dragover', handleBreadcrumbDragOver);
            item.addEventListener('drop', handleBreadcrumbDrop);
            item.addEventListener('dragleave', handleBreadcrumbDragLeave);
        }
    });
}

// 面包屑拖拽经过
function handleBreadcrumbDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    // 不在搜索模式下才允许
    if (searchKeyword) {
        return false;
    }
    
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('breadcrumb-drag-over');
    
    return false;
}

// 面包屑拖拽离开
function handleBreadcrumbDragLeave(e) {
    this.classList.remove('breadcrumb-drag-over');
}

// 面包屑放置
function handleBreadcrumbDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.preventDefault();
    this.classList.remove('breadcrumb-drag-over');
    
    const targetPathIndex = parseInt(this.getAttribute('data-path-index'));
    
    // 如果有多选，批量移动到目标路径
    if (selectedIndices.size > 1) {
        moveMultipleItemsToPath(Array.from(selectedIndices), targetPathIndex);
    } else if (draggedIndex !== null) {
        moveItemToPath(draggedIndex, targetPathIndex);
    }
    
    return false;
}

// 拖拽开始
function handleDragStart(e) {
    // 如果在搜索模式下，禁用拖拽
    if (searchKeyword) {
        e.preventDefault();
        return;
    }
    
    draggedElement = this;
    draggedIndex = parseInt(this.getAttribute('data-index'));
    
    // 如果拖动的项目未选中，且有其他选中项，清除选择并只拖动当前项
    if (!selectedIndices.has(draggedIndex) && selectedIndices.size > 0) {
        clearSelection();
    }
    
    // 如果拖动的项目未选中，将其选中
    if (!selectedIndices.has(draggedIndex)) {
        addToSelection(draggedIndex);
    }
    
    // 保存被拖动项目的完整数据
    const items = getCurrentItemsRef();
    draggedItem = JSON.parse(JSON.stringify(items[draggedIndex])); // 深拷贝
    
    this.classList.add('dragging');
    
    // 为其他选中的项目也添加 dragging 样式
    if (selectedIndices.size > 1) {
        document.querySelectorAll('.item.selected').forEach(item => {
            if (item !== this) {
                item.classList.add('dragging-multi');
            }
        });
    }
    
    e.dataTransfer.effectAllowed = 'move';
    
    // 如果是多选，显示数量标记
    if (selectedIndices.size > 1) {
        e.dataTransfer.setData('text/html', `拖动 ${selectedIndices.size} 个项目`);
        
        // 创建自定义拖拽图像
        const dragImage = document.createElement('div');
        dragImage.className = 'drag-count-badge';
        dragImage.textContent = selectedIndices.size;
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);
        
        if (e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(dragImage, 20, 20);
        }
        
        setTimeout(() => dragImage.remove(), 0);
    } else {
        e.dataTransfer.setData('text/html', this.innerHTML);
        if (e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(this, this.offsetWidth / 2, this.offsetHeight / 2);
        }
    }
}

// 拖拽结束
function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // 隐藏插入指示器
    hideDropIndicator();
    
    // 移除所有拖拽样式
    document.querySelectorAll('.item').forEach(item => {
        item.classList.remove('drag-over');
        item.classList.remove('dragging-multi');
    });
    
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.classList.remove('drag-over');
    }
    
    // 移除面包屑的 drag-over 类
    document.querySelectorAll('.breadcrumb-item').forEach(item => {
        item.classList.remove('breadcrumb-drag-over');
    });
    
    draggedElement = null;
    draggedIndex = null;
    draggedItem = null;
    insertIndex = -1;
}

// 拖拽经过
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    // 计算插入位置
    const grid = document.getElementById('itemsGrid');
    const items = Array.from(document.querySelectorAll('.item:not(.dragging):not(.dragging-multi)'));
    
    // 移除所有高亮
    items.forEach(item => item.classList.remove('drag-over'));
    
    if (items.length === 0) {
        insertIndex = 0;
        return false;
    }
    
    // 获取鼠标位置
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // 查找最近的项目
    let closestItem = null;
    let closestDistance = Infinity;
    let insertBefore = false;
    
    items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const itemCenterX = rect.left + rect.width / 2;
        const itemCenterY = rect.top + rect.height / 2;
        
        // 计算到项目中心的距离
        const distance = Math.sqrt(
            Math.pow(mouseX - itemCenterX, 2) + 
            Math.pow(mouseY - itemCenterY, 2)
        );
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestItem = item;
            
            // 判断是在项目前面还是后面
            // 如果是在网格布局中，需要考虑水平和垂直位置
            const isLeft = mouseX < itemCenterX;
            const isAbove = mouseY < itemCenterY;
            
            // 获取网格列数
            const gridStyle = window.getComputedStyle(grid);
            const gridCols = gridStyle.gridTemplateColumns.split(' ').length;
            
            // 计算当前项目在第几行第几列
            const itemIndex = parseInt(item.getAttribute('data-index'));
            const row = Math.floor(itemIndex / gridCols);
            const col = itemIndex % gridCols;
            
            // 如果鼠标在上方，插入到当前项之前
            // 如果鼠标在左侧且在同一行，插入到当前项之前
            // 否则插入到当前项之后
            if (isAbove) {
                insertBefore = true;
            } else if (isLeft && Math.floor((itemIndex) / gridCols) === row) {
                insertBefore = true;
            } else {
                insertBefore = false;
            }
        }
    });
    
    if (closestItem) {
        const targetIndex = parseInt(closestItem.getAttribute('data-index'));
        
        // 检查是否为文件夹，如果鼠标在文件夹中心附近，则高亮文件夹（表示要移入）
        const rect = closestItem.getBoundingClientRect();
        const itemCenterX = rect.left + rect.width / 2;
        const itemCenterY = rect.top + rect.height / 2;
        const distanceToCenter = Math.sqrt(
            Math.pow(mouseX - itemCenterX, 2) + 
            Math.pow(mouseY - itemCenterY, 2)
        );
        
        const items = getCurrentItemsRef();
        const targetItem = items[targetIndex];
        
        // 如果目标是文件夹且鼠标离中心很近，表示要移入文件夹
        if (targetItem && targetItem.type === 'folder' && distanceToCenter < 40) {
            closestItem.classList.add('drag-over');
            insertIndex = -1; // 表示要移入文件夹
            showDropIndicator(null); // 隐藏插入指示器
        } else {
            // 否则显示插入位置
            insertIndex = insertBefore ? targetIndex : targetIndex + 1;
            showDropIndicator(closestItem, insertBefore);
        }
    }
    
    return false;
}

// 显示插入位置指示器
function showDropIndicator(targetElement, insertBefore) {
    if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        document.getElementById('itemsGrid').appendChild(dropIndicator);
    }
    
    if (!targetElement) {
        dropIndicator.style.display = 'none';
        return;
    }
    
    const rect = targetElement.getBoundingClientRect();
    const grid = document.getElementById('itemsGrid');
    const gridRect = grid.getBoundingClientRect();
    
    dropIndicator.style.display = 'block';
    
    // 根据网格布局判断是显示垂直线还是水平线
    const gridStyle = window.getComputedStyle(grid);
    const gridCols = gridStyle.gridTemplateColumns.split(' ').length;
    const targetIndex = parseInt(targetElement.getAttribute('data-index'));
    const col = targetIndex % gridCols;
    
    if (insertBefore) {
        // 在目标项之前插入
        if (col === 0) {
            // 第一列，显示垂直线在左侧
            dropIndicator.style.left = (rect.left - gridRect.left - 2) + 'px';
            dropIndicator.style.top = (rect.top - gridRect.top) + 'px';
            dropIndicator.style.width = '4px';
            dropIndicator.style.height = rect.height + 'px';
        } else {
            // 其他列，显示垂直线在左侧
            dropIndicator.style.left = (rect.left - gridRect.left - 2) + 'px';
            dropIndicator.style.top = (rect.top - gridRect.top) + 'px';
            dropIndicator.style.width = '4px';
            dropIndicator.style.height = rect.height + 'px';
        }
    } else {
        // 在目标项之后插入
        dropIndicator.style.left = (rect.right - gridRect.left - 2) + 'px';
        dropIndicator.style.top = (rect.top - gridRect.top) + 'px';
        dropIndicator.style.width = '4px';
        dropIndicator.style.height = rect.height + 'px';
    }
}

// 隐藏插入位置指示器
function hideDropIndicator() {
    if (dropIndicator) {
        dropIndicator.style.display = 'none';
    }
}

// 拖拽离开
function handleDragLeave(e) {
    // 移除高亮
    const items = document.querySelectorAll('.item');
    items.forEach(item => item.classList.remove('drag-over'));
}

// 放置
function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.preventDefault();
    
    // 隐藏插入指示器
    hideDropIndicator();
    
    // 移除所有高亮
    document.querySelectorAll('.item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    const items = getCurrentItemsRef();
    
    // 如果 insertIndex 为 -1，表示要移入文件夹
    if (insertIndex === -1) {
        const dropIndex = parseInt(this.getAttribute('data-index'));
        const targetItem = items[dropIndex];
        
        if (targetItem && targetItem.type === 'folder') {
            if (selectedIndices.size > 1) {
                moveMultipleItemsToFolder(Array.from(selectedIndices), dropIndex);
            } else if (draggedIndex !== null) {
                moveItemToFolder(draggedIndex, dropIndex);
            }
        }
    } else {
        // 否则执行重新排序
        if (selectedIndices.size > 1) {
            // 多选时不支持重排序，只能移入文件夹
            showTemporaryMessage('複数選択時は並び替えできません。フォルダに移動してください。');
        } else if (draggedIndex !== null && insertIndex !== -1) {
            // 调整插入位置（如果拖动的项在插入位置之前）
            let adjustedInsertIndex = insertIndex;
            if (draggedIndex < insertIndex) {
                adjustedInsertIndex--;
            }
            
            if (draggedIndex !== adjustedInsertIndex) {
                reorderItems(draggedIndex, adjustedInsertIndex);
            }
        }
    }
    
    insertIndex = -1;
    return false;
}

// 返回按钮拖拽经过
function handleBackBtnDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    
    return false;
}

// 返回按钮拖拽离开
function handleBackBtnDragLeave(e) {
    this.classList.remove('drag-over');
}

// 返回按钮放置
function handleBackBtnDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.preventDefault();
    this.classList.remove('drag-over');
    
    // 如果有多选，批量移动到父文件夹
    if (selectedIndices.size > 1 && currentPath.length > 0) {
        moveMultipleItemsToParent(Array.from(selectedIndices));
    } else if (draggedIndex !== null && currentPath.length > 0) {
        moveItemToParentFolder(draggedIndex);
    }
    
    return false;
}

// 移动项目到文件夹
function moveItemToFolder(fromIndex, toFolderIndex) {
    const items = getCurrentItemsRef();
    const targetFolder = items[toFolderIndex];
    
    if (!targetFolder || targetFolder.type !== 'folder') {
        return;
    }
    
    // 不能将文件夹移动到自己内部
    if (fromIndex === toFolderIndex) {
        alert('フォルダを自分自身の中に移動できません');
        return;
    }
    
    // 确保目标文件夹有 children 数组
    if (!targetFolder.children) {
        targetFolder.children = [];
    }
    
    // 移除源项目
    const [movedItem] = items.splice(fromIndex, 1);
    
    // 如果删除操作影响了目标索引，需要调整
    const adjustedFolderIndex = fromIndex < toFolderIndex ? toFolderIndex - 1 : toFolderIndex;
    const folder = items[adjustedFolderIndex];
    
    // 添加到目标文件夹
    if (folder && folder.children) {
        folder.children.push(movedItem);
    }
    
    // 保存并重新渲染
    saveData();
    renderItems();
    
    // 显示提示
    showTemporaryMessage(`已将"${movedItem.name}"移动到"${folder.name}"`);
}

// 移动项目到父文件夹
function moveItemToParentFolder(itemIndex) {
    if (currentPath.length === 0) {
        return; // 已经在根目录
    }
    
    const items = getCurrentItemsRef();
    const [movedItem] = items.splice(itemIndex, 1);
    
    // 获取父文件夹
    const parentItems = getParentItemsRef();
    parentItems.push(movedItem);
    
    // 保存并重新渲染
    saveData();
    renderItems();
    
    // 显示提示
    showTemporaryMessage(`已将"${movedItem.name}"移动到上一级`);
}

// 移动项目到指定路径（通过面包屑）
function moveItemToPath(itemIndex, targetPathIndex) {
    const items = getCurrentItemsRef();
    const [movedItem] = items.splice(itemIndex, 1);
    
    // 获取目标路径的引用
    const targetItems = getItemsRefByPathIndex(targetPathIndex);
    targetItems.push(movedItem);
    
    // 保存并重新渲染
    saveData();
    renderItems();
    
    // 生成目标位置名称
    const targetName = targetPathIndex === -1 ? '主页' : currentPath[targetPathIndex];
    
    // 显示提示
    showTemporaryMessage(`已将"${movedItem.name}"移动到"${targetName}"`);
}

// 批量移动项目到文件夹
function moveMultipleItemsToFolder(indices, toFolderIndex) {
    const items = getCurrentItemsRef();
    const targetFolder = items[toFolderIndex];
    
    if (!targetFolder || targetFolder.type !== 'folder') {
        return;
    }
    
    // 确保目标文件夹有 children 数组
    if (!targetFolder.children) {
        targetFolder.children = [];
    }
    
    // 按索引倒序排序，从后往前删除，避免索引变化
    const sortedIndices = indices.sort((a, b) => b - a);
    const movedItems = [];
    
    sortedIndices.forEach(index => {
        // 不能将文件夹移动到自己
        if (index !== toFolderIndex) {
            const [item] = items.splice(index, 1);
            movedItems.push(item);
        }
    });
    
    // 添加到目标文件夹
    targetFolder.children.push(...movedItems.reverse());
    
    // 清除选择
    clearSelection();
    
    // 保存并重新渲染
    saveData();
    renderItems();
    
    // 显示提示
    showTemporaryMessage(`已将 ${movedItems.length} 个项目移动到"${targetFolder.name}"`);
}

// 批量移动项目到父文件夹
function moveMultipleItemsToParent(indices) {
    if (currentPath.length === 0) {
        return;
    }
    
    const items = getCurrentItemsRef();
    const parentItems = getParentItemsRef();
    
    // 按索引倒序排序
    const sortedIndices = indices.sort((a, b) => b - a);
    const movedItems = [];
    
    sortedIndices.forEach(index => {
        const [item] = items.splice(index, 1);
        movedItems.push(item);
    });
    
    // 添加到父文件夹
    parentItems.push(...movedItems.reverse());
    
    // 清除选择
    clearSelection();
    
    // 保存并重新渲染
    saveData();
    renderItems();
    
    // 显示提示
    showTemporaryMessage(`已将 ${movedItems.length} 个项目移动到上一级`);
}

// 批量移动项目到指定路径
function moveMultipleItemsToPath(indices, targetPathIndex) {
    const items = getCurrentItemsRef();
    const targetItems = getItemsRefByPathIndex(targetPathIndex);
    
    // 按索引倒序排序
    const sortedIndices = indices.sort((a, b) => b - a);
    const movedItems = [];
    
    sortedIndices.forEach(index => {
        const [item] = items.splice(index, 1);
        movedItems.push(item);
    });
    
    // 添加到目标位置
    targetItems.push(...movedItems.reverse());
    
    // 清除选择
    clearSelection();
    
    // 保存并重新渲染
    saveData();
    renderItems();
    
    // 生成目标位置名称
    const targetName = targetPathIndex === -1 ? '主页' : currentPath[targetPathIndex];
    
    // 显示提示
    showTemporaryMessage(`已将 ${movedItems.length} 个项目移动到"${targetName}"`);
}

// 根据路径索引获取项目列表引用
function getItemsRefByPathIndex(pathIndex) {
    // -1 表示根目录
    if (pathIndex === -1) {
        return favoritesData;
    }
    
    // 从根目录开始，逐层进入到指定路径
    let items = favoritesData;
    for (let i = 0; i <= pathIndex; i++) {
        const folderName = currentPath[i];
        const folder = items.find(item => item.type === 'folder' && item.name === folderName);
        if (folder && folder.children) {
            items = folder.children;
        } else {
            return favoritesData; // 如果路径不存在，返回根目录
        }
    }
    return items;
}

// 获取父级文件夹的引用
function getParentItemsRef() {
    if (currentPath.length === 0) {
        return favoritesData;
    }
    
    let items = favoritesData;
    for (let i = 0; i < currentPath.length - 1; i++) {
        const folder = items.find(item => item.type === 'folder' && item.name === currentPath[i]);
        if (folder && folder.children) {
            items = folder.children;
        }
    }
    return items;
}

// 显示临时消息提示
function showTemporaryMessage(message) {
    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;
    msgDiv.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(102, 126, 234, 0.95);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: fadeInOut 2s ease-in-out;
    `;
    
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
        msgDiv.remove();
    }, 2000);
}

// 重新排序项目
function reorderItems(fromIndex, toIndex) {
    const items = getCurrentItemsRef();
    
    // 移除拖拽的项目
    const [movedItem] = items.splice(fromIndex, 1);
    
    // 插入到新位置
    items.splice(toIndex, 0, movedItem);
    
    // 保存并重新渲染
    saveData();
    renderItems();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && currentPath.length > 0 && !event.target.matches('input, textarea')) {
        event.preventDefault();
        goBack();
    }
    
    if (event.key === 'Escape') {
        closeModal();
    }
});
