// API 基础URL - 使用你的 Worker URL
const API_BASE_URL = 'https://task-api.yvyan.top';

// 当前任务列表
let tasks = [];
let currentFilter = 'all';
let showCompleted = true;

// 通知系统
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notifications = new Map();
    }

    // 创建加载中通知
    createLoading(id, message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="spinner"></div>
            <span>${message}</span>
        `;
        this.container.appendChild(notification);
        this.notifications.set(id, notification);
        return id;
    }

    // 更新为成功状态
    success(id, message) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.className = 'notification success';
            notification.innerHTML = `
                <i class="fas fa-check"></i>
                <span>${message}</span>
            `;
            this.autoRemove(id);
        }
    }

    // 更新为错误状态
    error(id, message) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.className = 'notification error';
            notification.innerHTML = `
                <i class="fas fa-times"></i>
                <span>${message}</span>
            `;
            this.autoRemove(id);
        }
    }

    // 自动移除通知
    autoRemove(id, delay = 3000) {
        const notification = this.notifications.get(id);
        if (notification) {
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => {
                    notification.remove();
                    this.notifications.delete(id);
                }, 300);
            }, delay);
        }
    }
}

// 创建通知管理器实例
const notificationManager = new NotificationManager();

// 修改现有的 showLoading 和 hideLoading 函数
let initialLoadComplete = false;

function showLoading(message, isInitialLoad = false) {
    if (isInitialLoad && !initialLoadComplete) {
        document.getElementById('initialLoadingModal').style.display = 'block';
        return null;
    }
    return notificationManager.createLoading(Date.now(), message);
}

function hideLoading(loadingId, success = true, message = '') {
    if (loadingId === null) {
        document.getElementById('initialLoadingModal').style.display = 'none';
        initialLoadComplete = true;
        return;
    }
    if (success) {
        notificationManager.success(loadingId, message || '操作成功');
    } else {
        notificationManager.error(loadingId, message || '操作失败');
    }
}

// 添加一个全局的同步器变量
let synchronizer;

// 修改初始化函数
function initializeApp() {
    // 显示初始加载状态
    showLoading('加载任务列表...', true);
    
    // 设置默认筛选为最近七天
    currentFilter = 'week';
    document.querySelector('.filter-group select').value = 'week';
    
    // 初始化同步器并开始同步
    synchronizer = new TaskSynchronizer();
    synchronizer.sync(); // 直接调用 sync 而不是 start
}

// 修改页面加载事件监听器
document.addEventListener('DOMContentLoaded', initializeApp);

// 获取任务列表
async function fetchTasks() {
    const loadingId = showLoading('获取任务列表...', true);
    try {
        const response = await fetch(`${API_BASE_URL}/tasks`);
        tasks = await response.json();
        renderTasks();
        hideLoading(loadingId, true);
    } catch (error) {
        hideLoading(loadingId, false, '获取任务列表失败');
    }
}

// 按日期对任务进行分组
function groupTasksByDate(tasks) {
    const groups = new Map();
    
    tasks.forEach(task => {
        if (!task.due_date) {
            const key = '未设置日期';
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(task);
            return;
        }

        const date = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((date - today) / (86400000));
        let key;
        
        if (date < today) {
            key = '已过期';
        } else if (diffDays === 0) {
            key = '今天';
        } else if (diffDays === 1) {
            key = '明天';
        } else {
            const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            key = `${date.getMonth() + 1}月${date.getDate()}日，${weekdays[date.getDay()]}`;
        }
        
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(task);
    });
    
    return groups;
}

// 添加防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 优化渲染函数
const debouncedRender = debounce(() => {
    const filteredTasks = filterTasksList(tasks);
    const sortedTasks = sortTasks(filteredTasks);
    renderTaskList(sortedTasks);
}, 100);

// 使用优化后的渲染
function renderTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    // 先筛选，再排序
    const filteredTasks = filterTasksList(tasks);
    const sortedTasks = sortTasks(filteredTasks);
    
    // 如果没有任务，显示空状态
    if (sortedTasks.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-icon">📋</div>
            <h3>暂无任务</h3>
            <p>${getEmptyStateMessage()}</p>
            <button onclick="openTaskModal()" class="btn-primary">
                <i class="fas fa-plus"></i>
                添加第一个任务
            </button>
        `;
        taskList.appendChild(emptyState);
        return;
    }
    
    // 按日期分组
    const groupedTasks = groupTasksByDate(sortedTasks);
    
    // 渲染分组
    for (const [date, tasksInGroup] of groupedTasks) {
        // 添加日期标题
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        
        // 格式化日期显示
        let dateText;
        if (date === '已过期') {
            dateText = `<span class="date-text" style="color: var(--danger-color)">已过期</span>`;
        } else if (date === '今天') {
            dateText = `<span class="date-text">今天</span>`;
        } else if (date === '明天') {
            dateText = `<span class="date-text">明天</span>`;
        } else if (date === '未设置日期') {
            dateText = `<span class="date-text">未设置日期</span>`;
        } else {
            const [monthDay, weekday] = date.split('，');
            dateText = `
                <span class="date-text">${monthDay}</span>
                <span class="weekday">${weekday}</span>
            `;
        }
        
        dateHeader.innerHTML = dateText;
        taskList.appendChild(dateHeader);
        
        // 渲染该日期下的任务
        tasksInGroup.forEach(task => {
            const taskElement = createTaskElement(task);
            taskList.appendChild(taskElement);
        });
    }
}

// 根据当前筛选条件返回合适的空状态消息
function getEmptyStateMessage() {
    switch (currentFilter) {
        case 'active':
            return '太棒了！所有任务都已完成';
        case 'today':
            return '今天没有待办任务';
        case 'week':
            return '本周没有待办任务';
        default:
            return showCompleted ? 
                '开始添加你的第一个任务吧' : 
                '没有未完成的任务';
    }
}

// 修改排序函数
function sortTasks(tasksList) {
    return tasksList.sort((a, b) => {
        // 首先按日期排序
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        
        // 获取日期部分（不包含时间）
        const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
        const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());
        
        // 如果是不同天，按日期排序
        if (dayA.getTime() !== dayB.getTime()) {
            return dayA.getTime() - dayB.getTime();
        }
        
        // 同一天的任务，先按完成状态排序
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        
        // 如果完成状态相同，按具体时间排序（包括小时和分钟）
        return dateA.getTime() - dateB.getTime();
    });
}

// 根据筛选条件过滤任务列表
function filterTasksList(tasksList) {
    let filteredList = showCompleted ? 
        tasksList : 
        tasksList.filter(task => !task.completed);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    switch (currentFilter) {
        case 'active':
            return filteredList.filter(task => !task.completed);
        case 'today':
            return filteredList.filter(task => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                return taskDate >= today && taskDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
            });
        case 'week':
            return filteredList.filter(task => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                return taskDate >= today && taskDate <= weekLater;
            });
        default:
            return filteredList;
    }
}

// 格式化日期 - 增强显示效果
function formatDate(dateString) {
    if (!dateString) return '无截止日期';
    
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 计算时间差（天数）
    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));

    // 根据时间差显示不同的格式
    if (date < today) {
        return `已过期 (${date.toLocaleDateString('zh-CN')})`;
    } else if (diffDays === 0) {
        return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
        return `明天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return `${diffDays}天后 (${date.toLocaleDateString('zh-CN')})`;
    }
}

// 创建任务元素
function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-item ${task.completed ? 'completed' : ''}`;
    div.setAttribute('data-id', task.id);
    
    // 添加紧急程度类
    if (!task.completed && task.due_date) {
        const dueDate = new Date(task.due_date);
        const now = new Date();
        const diffHours = (dueDate - now) / (1000 * 60 * 60);
        
        if (diffHours < 0) {
            div.classList.add('overdue');
        } else if (diffHours < 24) {
            div.classList.add('urgent');
        } else if (diffHours < 72) {
            div.classList.add('warning');
        }
    }
    
    // 获取时间状态
    const timeStatus = getTimeStatus(task.due_date);
    
    div.innerHTML = `
        <div class="task-checkbox" onclick="toggleTaskStatus(${task.id}, event)"></div>
        <div class="task-info">
            <div class="task-header" onclick="toggleTaskDetails(this.parentElement.parentElement)">
                <h3>${task.name}</h3>
                <div class="task-time ${timeStatus.class}">
                    <i class="far fa-clock"></i>
                    ${timeStatus.text}
                </div>
            </div>
            <div class="task-description">
                <p>${task.description || '无描述'}</p>
                <div class="task-actions">
                    <button onclick="editTask(${task.id}, event)" class="btn-primary">
                        <i class="fas fa-edit"></i>
                        编辑
                    </button>
                    <button onclick="deleteTask(${task.id}, event)" class="btn-danger">
                        <i class="fas fa-trash"></i>
                        删除
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return div;
}

// 获取时间状态
function getTimeStatus(dateString) {
    if (!dateString) {
        return { text: '无截止日期', class: '' };
    }
    
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    if (date < today) {
        return { 
            text: `已过期 (${date.toLocaleDateString('zh-CN')})`,
            class: 'overdue'
        };
    } else if (diffDays === 0) {
        return {
            text: `今天 ${timeStr}`,
            class: 'today'
        };
    } else if (diffDays === 1) {
        return {
            text: `明天 ${timeStr}`,
            class: 'tomorrow'
        };
    } else {
        return {
            text: `${diffDays}天后 (${date.toLocaleDateString('zh-CN')})`,
            class: ''
        };
    }
}

// 切换任务详情显示
function toggleTaskDetails(taskElement) {
    taskElement.classList.toggle('expanded');
}

// 切换任务状态
async function toggleTaskStatus(taskId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    const task = tasks[taskIndex];
    const newStatus = !task.completed;
    
    // 保存原始状态
    const originalTask = { ...task };
    
    // 在本地更新状态
    task.completed = newStatus;
    synchronizer.trackLocalChange(taskId, 'update', task);
    renderTasks();
    
    const loadingId = showLoading('更新任务状态...');
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                completed: newStatus
            })
        });
        
        if (!response.ok) throw new Error('更新任务状态失败');
        
        const updatedTask = await response.json();
        // 更新本地任务状态
        const currentIndex = tasks.findIndex(t => t.id === taskId);
        if (currentIndex !== -1) {
            tasks[currentIndex] = { 
                ...tasks[currentIndex], // 保留本地其他属性
                ...updatedTask // 更新服务器返回的属性
            };
        }
        synchronizer.localChanges.delete(taskId);
        renderTasks();
        hideLoading(loadingId, true, '任务状态已更新');
    } catch (error) {
        // 恢复原始状态
        const currentIndex = tasks.findIndex(t => t.id === taskId);
        if (currentIndex !== -1) {
            tasks[currentIndex] = originalTask;
        }
        synchronizer.localChanges.delete(taskId);
        renderTasks();
        hideLoading(loadingId, false, error.message);
    }
}

// 筛选任务
function filterTasks(filter) {
    currentFilter = filter;
    renderTasks();
}

// 编辑任务
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        console.error('未找到任务:', taskId);
        return;
    }
    
    openTaskModal(taskId);
}

// 切换显示已完成任务
function toggleCompletedTasks() {
    showCompleted = !showCompleted;
    document.getElementById('showCompletedText').textContent = 
        showCompleted ? '隐藏已完成' : '显示已完成';
    renderTasks();
}

// 修改筛选函数
function filterTasksList(tasksList) {
    let filteredList = showCompleted ? 
        tasksList : 
        tasksList.filter(task => !task.completed);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    switch (currentFilter) {
        case 'active':
            return filteredList.filter(task => !task.completed);
        case 'today':
            return filteredList.filter(task => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                return taskDate >= today && taskDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
            });
        case 'week':
            return filteredList.filter(task => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                return taskDate >= today && taskDate <= weekLater;
            });
        default:
            return filteredList;
    }
}

// 自定义确认对话框
function showConfirm(message, title = '确认') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'block';

        function handleYes() {
            cleanup();
            resolve(true);
        }

        function handleNo() {
            cleanup();
            resolve(false);
        }

        function cleanup() {
            modal.style.display = 'none';
            yesBtn.removeEventListener('click', handleYes);
            noBtn.removeEventListener('click', handleNo);
        }

        yesBtn.addEventListener('click', handleYes);
        noBtn.addEventListener('click', handleNo);
    });
}

// 打开任务模态框
function openTaskModal(taskId = null) {
    const task = taskId ? tasks.find(t => t.id === taskId) : null;
    const modal = document.getElementById('taskModal');
    const form = document.getElementById('taskForm');
    
    // 设置标题
    document.getElementById('modalTitle').textContent = task ? '编辑任务' : '添加任务';
    
    // 设置表单值
    document.getElementById('taskId').value = task ? task.id : '';
    document.getElementById('taskName').value = task ? task.name : '';
    document.getElementById('taskDescription').value = task ? task.description || '' : '';
    
    // 设置截止时间
    if (task) {
        // 如果是编辑任务，使用现有的截止时间
        document.getElementById('taskDueDate').value = task.due_date || '';
    } else {
        // 如果是新任务，设置默认截止时间为一小时后
        const defaultDate = new Date();
        defaultDate.setHours(defaultDate.getHours() + 1);
        
        // 格式化日期时间，考虑本地时区
        const year = defaultDate.getFullYear();
        const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
        const day = String(defaultDate.getDate()).padStart(2, '0');
        const hours = String(defaultDate.getHours()).padStart(2, '0');
        const minutes = String(defaultDate.getMinutes()).padStart(2, '0');
        
        const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        document.getElementById('taskDueDate').value = formattedDateTime;
    }
    
    // 显示模态框
    modal.style.display = 'block';
}

// 关闭任务模态框
function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    const form = document.getElementById('taskForm');
    modal.style.display = 'none';
    form.reset();
}

// 修改处理任务提交函数
async function handleTaskSubmit(event) {
    event.preventDefault();
    
    const taskId = document.getElementById('taskId').value;
    const taskData = {
        name: document.getElementById('taskName').value,
        description: document.getElementById('taskDescription').value,
        due_date: document.getElementById('taskDueDate').value
    };
    
    // 立即关闭模态框
    document.getElementById('taskModal').style.display = 'none';
    
    // 显示加载提示
    const loadingId = showLoading(taskId ? '更新任务...' : '创建任务...');
    
    // 生成临时任务ID
    const tempId = `temp_${Date.now()}`;
    
    try {
        if (taskId) {
            // 编辑任务
            const taskIndex = tasks.findIndex(t => t.id === parseInt(taskId));
            if (taskIndex !== -1) {
                const updatedTask = { ...tasks[taskIndex], ...taskData };
                tasks[taskIndex] = updatedTask;
                synchronizer.trackLocalChange(parseInt(taskId), 'update', updatedTask);
                renderTasks();
            }
            
            const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            
            if (!response.ok) throw new Error('更新任务失败');
            const serverTask = await response.json();
            synchronizer.confirmChange(parseInt(taskId), serverTask);
            
        } else {
            // 添加任务
            // 先创建临时任务并显示
            const tempTask = {
                id: tempId,
                name: taskData.name,
                description: taskData.description,
                due_date: taskData.due_date,  // 直接使用表单中的时间
                completed: false,
                created_at: new Date().toISOString()
            };
            tasks.push(tempTask);
            synchronizer.trackLocalChange(tempId, 'create', tempTask);
            renderTasks();

            // 然后发送到服务器
            const response = await fetch(`${API_BASE_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            
            if (!response.ok) throw new Error('创建任务失败');
            const newTask = await response.json();
            
            // 用服务器返回的数据更新本地任务
            const tempIndex = tasks.findIndex(t => t.id === tempId);
            if (tempIndex !== -1) {
                tasks[tempIndex] = {
                    ...newTask,
                    due_date: taskData.due_date,  // 确保使用原始的时间
                    _localState: { isNew: true }
                };
                synchronizer.localChanges.delete(tempId);
            }
            
            // 记录为最近确认的任务
            synchronizer.lastConfirmedTask = {
                id: newTask.id,
                task: { 
                    ...newTask,
                    due_date: taskData.due_date  // 确保使用原始的时间
                },
                timestamp: Date.now() + 5000
            };
            
            renderTasks();
        }
        
        hideLoading(loadingId, true, taskId ? '任务已更新' : '任务已创建');
    } catch (error) {
        console.error('操作失败:', error);
        if (!taskId) {
            tasks = tasks.filter(t => t.id !== tempId);
            renderTasks();
        }
        hideLoading(loadingId, false, error.message);
    }
}

// 删除任务
async function deleteTask(taskId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const confirmed = await showConfirm('确定要删除这个任务吗？', '删除任务');
    if (!confirmed) return;

    // 先在本地删除任务
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    const taskElement = document.querySelector(`.task-item[data-id="${taskId}"]`);
    if (taskElement) {
        taskElement.style.animation = 'slideOut 0.3s ease forwards';
    }
    
    const deletedTask = tasks.splice(taskIndex, 1)[0];
    renderTasks(); // 只重新渲染受影响的日期组
    
    // 后台同步
    const loadingId = showLoading('删除任务...');
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            // 如果删除失败，恢复任务
            tasks.splice(taskIndex, 0, deletedTask);
            renderTasks();
            throw new Error('删除任务失败');
        }
        
        hideLoading(loadingId, true, '任务已删除');
    } catch (error) {
        hideLoading(loadingId, false, error.message);
    }
}

// 修改 TaskSynchronizer 类
class TaskSynchronizer {
    constructor(interval = 10000) {
        this.interval = interval;
        this.isInitialSync = true;
        this.syncTimer = null;
        this.localChanges = new Map();
        this.lastConfirmedTask = null;
        this.lastCleanup = null;
        
        // 启动定时清理
        this.scheduleCleanup();
    }

    async sync() {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks`);
            if (!response.ok) throw new Error('同步失败');
            const serverTasks = await response.json();
            
            if (this.isInitialSync) {
                tasks = serverTasks;
                renderTasks();
                this.isInitialSync = false;
                hideLoading(null, true);
            } else {
                this.mergeTasks(serverTasks);
            }
        } catch (error) {
            if (this.isInitialSync) {
                hideLoading(null, false, '获取任务列表失败');
            }
        } finally {
            this.scheduleNextSync();
        }
    }

    confirmChange(taskId, serverTask) {
        if (!taskId || !serverTask) return;
        
        const index = tasks.findIndex(t => t && t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...serverTask };
        } else {
            tasks.push({ ...serverTask });
        }
        
        this.localChanges.delete(taskId);
        renderTasks();
    }

    trackLocalChange(taskId, type, task) {
        if (!taskId) return;
        
        this.localChanges.set(taskId, {
            type,
            task: { ...task },
            timestamp: Date.now()
        });
    }

    scheduleNextSync() {
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        this.syncTimer = setTimeout(() => this.sync(), this.interval);
    }

    mergeTasks(serverTasks) {
        if (!serverTasks || !Array.isArray(serverTasks)) return;

        // 创建当前任务的映射，用于快速查找
        const currentTasksMap = new Map(tasks.map(task => [task.id, task]));
        const newTasks = [];

        // 处理服务器任务
        serverTasks.forEach(serverTask => {
            if (!serverTask || !serverTask.id) return;

            const localTask = currentTasksMap.get(serverTask.id);
            const hasLocalChange = this.localChanges.has(serverTask.id);

            if (hasLocalChange && localTask) {
                // 如果有本地更改，保留本地版本
                newTasks.push(localTask);
            } else {
                // 否则使用服务器版本
                newTasks.push(serverTask);
            }
        });

        // 添加本地临时任务
        tasks.forEach(localTask => {
            if (!localTask || !localTask.id) return;

            // 如果是临时任务或者服务器上还没有的任务
            if (
                (typeof localTask.id === 'string' && localTask.id.startsWith('temp_')) ||
                !serverTasks.some(t => t.id === localTask.id)
            ) {
                newTasks.push(localTask);
            }
        });

        // 更新任务列表并重新渲染
        tasks = newTasks;
        renderTasks();
    }

    // 添加清理历史任务的方法
    async cleanupHistoricalTasks() {
        const now = new Date();
        const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
        let hasDeleted = false;

        // 找出需要删除的任务
        const tasksToDelete = tasks.filter(task => 
            task.completed && 
            new Date(task.due_date) < oneMonthAgo
        );

        // 删除任务
        for (const task of tasksToDelete) {
            try {
                const response = await fetch(`${API_BASE_URL}/tasks/${task.id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    hasDeleted = true;
                }
            } catch (error) {
                console.error('删除历史任务失败:', task.id);
            }
        }

        // 如果有任务被删除，更新本地任务列表
        if (hasDeleted) {
            tasks = tasks.filter(task => 
                !(task.completed && new Date(task.due_date) < oneMonthAgo)
            );
            renderTasks();
        }

        // 更新最后清理时间
        this.lastCleanup = Date.now();
    }

    // 添加调度清理的方法
    scheduleCleanup() {
        // 如果从未清理过或者距离上次清理超过24小时
        const shouldCleanup = !this.lastCleanup || 
            (Date.now() - this.lastCleanup) > 24 * 60 * 60 * 1000;

        if (shouldCleanup) {
            this.cleanupHistoricalTasks();
        }

        // 每24小时检查一次
        setTimeout(() => this.scheduleCleanup(), 24 * 60 * 60 * 1000);
    }
}

class TaskManager {
    constructor() {
        this._tasks = [];
        this._filteredTasks = null;
        this._lastFilter = null;
        this._lastShowCompleted = null;
    }

    updateTasks(newTasks) {
        this._tasks = newTasks;
        this._filteredTasks = null; // 清除缓存
    }

    getFilteredTasks(filter, showCompleted) {
        // 如果筛选条件没变且缓存存在，直接返回缓存
        if (this._filteredTasks && 
            this._lastFilter === filter && 
            this._lastShowCompleted === showCompleted) {
            return this._filteredTasks;
        }

        // 重新计算并缓存结果
        this._lastFilter = filter;
        this._lastShowCompleted = showCompleted;
        this._filteredTasks = filterTasksList(this._tasks);
        return this._filteredTasks;
    }
}

function renderTaskList(tasksList) {
    const container = document.getElementById('taskList');
    const fragment = document.createDocumentFragment();
    
    // 按日期分组
    const groups = groupTasksByDate(tasksList);
    
    groups.forEach((tasks, date) => {
        const groupElement = createDateGroup(date, tasks);
        fragment.appendChild(groupElement);
    });
    
    // 一次性更新 DOM
    container.innerHTML = '';
    container.appendChild(fragment);
}

// 在任务列表容器上使用事件委托
document.getElementById('taskList').addEventListener('click', (event) => {
    const taskItem = event.target.closest('.task-item');
    if (!taskItem) return;

    const action = event.target.dataset.action;
    const taskId = parseInt(taskItem.dataset.id);

    switch(action) {
        case 'toggle':
            toggleTaskStatus(taskId, event);
            break;
        case 'edit':
            editTask(taskId);
            break;
        case 'delete':
            deleteTask(taskId);
            break;
    }
}); 

const DateHelper = {
    _today: null,
    _weekLater: null,
    
    get today() {
        if (!this._today) {
            const now = new Date();
            this._today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        return this._today;
    },
    
    get weekLater() {
        if (!this._weekLater) {
            this._weekLater = new Date(this.today);
            this._weekLater.setDate(this._weekLater.getDate() + 7);
        }
        return this._weekLater;
    },
    
    resetCache() {
        this._today = null;
        this._weekLater = null;
    }
}; 