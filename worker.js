// D1 数据库初始化 SQL - 将 SQL 语句写成一行
const INIT_SQL = `
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT NULL,
        due_date TEXT DEFAULT NULL,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;

// 处理请求的主函数
export default {
    async fetch(request, env) {
        try {
            // 尝试创建表
            try {
                await env.DB.prepare(INIT_SQL).run();
            } catch (dbError) {
                console.error('创建表失败:', dbError);
            }
            
            // 处理 CORS
            if (request.method === 'OPTIONS') {
                return new Response(null, {
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type',
                    },
                });
            }
            
            const url = new URL(request.url);
            const path = url.pathname;
            
            // 路由处理
            if (path === '/tasks' && request.method === 'GET') {
                return await getTasks(env.DB);
            } else if (path === '/tasks' && request.method === 'POST') {
                return await createTask(request, env.DB);
            } else if (path.match(/\/tasks\/\d+/) && request.method === 'PATCH') {
                const id = path.split('/')[2];
                return await updateTask(id, request, env.DB);
            } else if (path.match(/\/tasks\/\d+/) && request.method === 'DELETE') {
                const id = path.split('/')[2];
                return await deleteTask(id, env.DB);
            }
            
            return new Response('Not Found', { status: 404 });
        } catch (error) {
            return new Response(`Error: ${error.message}`, { 
                status: 500,
                headers: {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }
    }
};

// 获取所有任务
async function getTasks(db) {
    const tasks = await db.prepare(
        'SELECT * FROM tasks ORDER BY created_at DESC'
    ).all();
    
    return corsResponse(tasks.results);
}

// 创建新任务
async function createTask(request, db) {
    try {
        const data = await request.json();
        
        // 严格处理所有字段
        if (!data.name) {
            return corsResponse({ error: '任务名称是必需的' }, 400);
        }

        // 规范化数据
        const name = String(data.name || '').trim();
        const description = data.description === '' ? null : (data.description || null);
        const due_date = data.due_date || null;

        // 插入新任务
        const sql = `
            INSERT INTO tasks (name, description, due_date) 
            VALUES (?1, ?2, ?3)
        `;

        const insertResult = await db.prepare(sql)
            .bind(name, description, due_date)
            .run();
        
        const lastId = insertResult.meta?.last_row_id;
        
        if (!lastId) {
            return corsResponse({ error: '创建任务失败' }, 500);
        }

        // 查询新创建的任务
        const newTask = await db.prepare('SELECT * FROM tasks WHERE id = ?1')
            .bind(lastId)
            .first();

        // 返回完整的任务数据
        return corsResponse({
            id: lastId,
            name: name,
            description: description || '',
            due_date: due_date || null,
            completed: false,
            created_at: newTask?.created_at || new Date().toISOString()
        }, 201);
        
    } catch (error) {
        return corsResponse({ error: error.message }, 500);
    }
}

// 更新任务
async function updateTask(id, request, db) {
    try {
        const data = await request.json();
        console.log('更新任务数据:', { id, data });

        if ('completed' in data) {
            // 处理完成状态更新
            const sql = 'UPDATE tasks SET completed = ?1 WHERE id = ?2';
            await db.prepare(sql)
                .bind(data.completed ? 1 : 0, id)
                .run();
        } else {
            // 规范化数据
            const taskData = {
                name: typeof data.name === 'string' ? String(data.name).trim() : null,
                description: typeof data.description === 'string' ? data.description.trim() : null,
                due_date: typeof data.due_date === 'string' && data.due_date ? data.due_date : null
            };

            // 验证必填字段
            if (!taskData.name) {
                return corsResponse({ error: '任务名称是必需的' }, 400);
            }

            const sql = `
                UPDATE tasks 
                SET name = ?1, 
                    description = ?2, 
                    due_date = ?3 
                WHERE id = ?4
            `;
            await db.prepare(sql)
                .bind(
                    taskData.name,
                    taskData.description,
                    taskData.due_date,
                    id
                )
                .run();
        }
        
        // 获取更新后的任务数据
        const updatedTask = await db.prepare('SELECT * FROM tasks WHERE id = ?1')
            .bind(id)
            .first();
        
        if (!updatedTask) {
            return corsResponse({ error: '任务不存在' }, 404);
        }

        // 返回完整的任务数据
        return corsResponse({
            id: parseInt(id),
            name: updatedTask.name,
            description: updatedTask.description || '',
            due_date: updatedTask.due_date || null,
            completed: Boolean(updatedTask.completed),
            created_at: updatedTask.created_at
        });
    } catch (error) {
        console.error('更新任务错误:', error);
        return corsResponse({ error: error.message }, 500);
    }
}

// 删除任务
async function deleteTask(id, db) {
    try {
        console.log('删除任务:', id);  // 添加日志
        
        const sql = 'DELETE FROM tasks WHERE id = ?1';
        console.log('执行 SQL:', sql);
        
        await db.prepare(sql)
            .bind(id)
            .run();
        
        return corsResponse({ success: true });
    } catch (error) {
        console.error('删除任务错误:', error);
        return corsResponse({ error: error.message }, 500);
    }
}

// 添加 CORS 头的响应
function corsResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
} 