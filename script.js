// Конфигурация
const CONFIG = {
    MAX_USERS: 30,
    POST_AUTO_HIDE_DAYS: 10,
    ADMIN_EMAIL: 'kaktyz896@gmail.com'
};

// Глобальные переменные
let currentUser = null;
let posts = [];
let users = [];

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    checkOldPosts();
    
    // Проверяем гостевую сессию
    const guestSession = getCookie('guestSession');
    if (guestSession) {
        enterAsGuest(guestSession);
    }
    
    // Проверяем старые посты каждые 5 минут
    setInterval(checkOldPosts, 300000);
});

// Система пользователей
class UserManager {
    static createGuest() {
        const guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
        return {
            type: 'guest',
            id: guestId,
            username: 'Гость_' + guestId.substr(6, 4),
            created: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
    }
    
    static createVerified(email) {
        return {
            type: 'verified',
            email: email,
            username: email.split('@')[0],
            created: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            isAdmin: email === CONFIG.ADMIN_EMAIL
        };
    }
    
    static isAdmin(user) {
        return user && user.isAdmin;
    }
}

// Система постов
class PostManager {
    static createPost(data, author) {
        const contentAnalysis = ModerationBot.analyzeContent(data.content + ' ' + data.title);
        
        return {
            id: Date.now().toString(),
            title: data.title,
            content: data.content,
            author: author.username,
            authorType: author.type,
            timestamp: new Date().toISOString(),
            isNSFW: data.isNSFW || contentAnalysis.isNSFW,
            image: data.image,
            comments: [],
            hidden: false,
            reports: [],
            lastActivity: new Date().toISOString(),
            autoHideDate: new Date(Date.now() + CONFIG.POST_AUTO_HIDE_DAYS * 24 * 60 * 60 * 1000).toISOString()
        };
    }
    
    static addComment(postId, content, author) {
        const post = posts.find(p => p.id === postId);
        if (!post) return false;
        
        const commentAnalysis = ModerationBot.analyzeContent(content);
        
        post.comments.push({
            id: Date.now().toString(),
            content: content,
            author: author.username,
            authorType: author.type,
            timestamp: new Date().toISOString(),
            isNSFW: commentAnalysis.isNSFW,
            hidden: false
        });
        
        post.lastActivity = new Date().toISOString();
        return true;
    }
    
    static shouldHidePost(post) {
        if (post.hidden) return false;
        
        const lastActivity = new Date(post.lastActivity);
        const now = new Date();
        const daysDiff = (now - lastActivity) / (1000 * 60 * 60 * 24);
        
        return daysDiff >= CONFIG.POST_AUTO_HIDE_DAYS && post.comments.length === 0;
    }
}

// Бот модерации
class ModerationBot {
    static bannedWords = [
        // Наркотики
        'героин', 'кокаин', 'метамфетамин', 'ЛСД', 'марихуана', 'гашиш',
        'амфетамин', 'экстази', 'морфин', 'кодеин', 'трамадол',
        'спайс', 'соль', 'мефедрон', 'альфа-PVP',
        
        // Оскорбления
        'убью', 'убить', 'сдохни', 'умри'
    ];
    
    static nsfwPatterns = [
        'суицид', 'самоубийство', 'труп', 'мертв', 'смерть',
        'кровь', 'рана', 'насилие', 'убийство', 'травма'
    ];
    
    static analyzeContent(text) {
        const lowerText = text.toLowerCase();
        
        return {
            hasBannedWords: this.bannedWords.some(word => lowerText.includes(word)),
            isNSFW: this.nsfwPatterns.some(pattern => lowerText.includes(pattern)),
            riskLevel: this.calculateRiskLevel(lowerText)
        };
    }
    
    static calculateRiskLevel(text) {
        let score = 0;
        
        this.bannedWords.forEach(word => {
            if (text.includes(word)) score += 2;
        });
        
        this.nsfwPatterns.forEach(pattern => {
            if (text.includes(pattern)) score += 1;
        });
        
        if (score >= 3) return 'high';
        if (score >= 1) return 'medium';
        return 'low';
    }
}

// Основные функции интерфейса
function showRules() {
    if (!document.getElementById('ageConfirm').checked) {
        alert('Подтвердите что вам есть 18 лет');
        return;
    }
    
    switchScreen('rulesScreen');
}

function goToMain() {
    if (!currentUser) {
        enterAsGuest();
        return;
    }
    switchScreen('mainScreen');
    loadPosts();
    updateUserInfo();
}

function enterSite() {
    if (!document.getElementById('ageConfirm').checked) {
        alert('Подтвердите что вам есть 18 лет');
        return;
    }
    
    // Сразу входим как гость (без email верификации для простоты)
    enterAsGuest();
}

function enterAsGuest(guestId = null) {
    if (guestId) {
        // Восстанавливаем существующую гостевую сессию
        currentUser = users.find(u => u.id === guestId) || UserManager.createGuest();
    } else {
        currentUser = UserManager.createGuest();
        users.push(currentUser);
    }
    
    setCookie('guestSession', currentUser.id, 7);
    saveData();
    goToMain();
}

function createPost(event) {
    event.preventDefault();
    
    if (!currentUser) {
        alert('Войдите в систему для создания постов');
        return;
    }
    
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const isNSFW = document.getElementById('isNSFW').checked;
    
    if (!title.trim() || !content.trim()) {
        alert('Заполните заголовок и текст поста');
        return;
    }
    
    const postData = {
        title: title,
        content: content,
        isNSFW: isNSFW,
        image: null
    };
    
    // Обработка изображения
    const imageInput = document.getElementById('postImage');
    if (imageInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            postData.image = e.target.result;
            finishPostCreation(postData);
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        finishPostCreation(postData);
    }
    
    return false;
}

function finishPostCreation(postData) {
    const newPost = PostManager.createPost(postData, currentUser);
    posts.unshift(newPost);
    
    saveData();
    loadPosts();
    resetPostForm();
    
    // Проверка модерации
    const analysis = ModerationBot.analyzeContent(postData.content + ' ' + postData.title);
    if (analysis.riskLevel === 'high') {
        console.log('Высокий риск содержания в посте:', newPost.id);
    }
}

function resetPostForm() {
    document.getElementById('postForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
}

function previewImage(input) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function loadPosts() {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';
    
    const visiblePosts = posts.filter(post => !post.hidden || post.author === currentUser.username);
    
    if (visiblePosts.length === 0) {
        container.innerHTML = `
            <div class="post text-center">
                <h3>😴 Пока нет постов</h3>
                <p>Будьте первым, кто создаст пост на этой доске!</p>
            </div>
        `;
        return;
    }
    
    visiblePosts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
    
    updateAdminStats();
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.id = `post-${post.id}`;
    
    const isAuthor = post.author === currentUser.username;
    const canModerate = UserManager.isAdmin(currentUser);
    
    let contentHTML = `
        <div class="post-header">
            <div>
                <span class="post-author">${escapeHtml(post.author)}</span>
                ${post.authorType === 'verified' ? '✓' : '👤'}
            </div>
            <div class="post-date">${formatDate(post.timestamp)}</div>
        </div>
        
        <h3>${escapeHtml(post.title)}</h3>
    `;
    
    // Теги
    const tags = [];
    if (post.isNSFW) tags.push('<span class="tag">🔞 NSFW</span>');
    if (post.comments.length > 0) tags.push(`<span class="tag">💭 ${post.comments.length}</span>`);
    
    if (tags.length > 0) {
        contentHTML += `<div class="post-tags">${tags.join('')}</div>`;
    }
    
    // Контент с NSFW защитой
    if (post.isNSFW) {
        contentHTML += `
            <div class="nsfw-warning">
                <strong>🔞 ВНИМАНИЕ: NSFW/NSFL КОНТЕНТ</strong>
                <p>Этот пост содержит контент, который может шокировать.</p>
                <button class="btn-warning" onclick="showNSFWModal('${post.id}')">Показать контент</button>
            </div>
            <div id="nsfw-content-${post.id}" class="nsfw-content">
                ${formatPostContent(post)}
            </div>
        `;
    } else {
        contentHTML += `<div class="post-content">${formatPostContent(post)}</div>`;
    }
    
    // Комментарии
    if (post.comments.length > 0) {
        contentHTML += `<div class="comments-section">`;
        post.comments.filter(comment => !comment.hidden).forEach(comment => {
            contentHTML += `
                <div class="comment">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHtml(comment.author)}</span>
                        <span class="post-date">${formatDate(comment.timestamp)}</span>
                    </div>
                    <div class="post-content">${escapeHtml(comment.content)}</div>
                </div>
            `;
        });
        contentHTML += `</div>`;
    }
    
    // Форма комментария
    contentHTML += `
        <div class="comment-form">
            <textarea id="comment-${post.id}" placeholder="Ваш комментарий" rows="2"></textarea>
            <button class="btn-primary" onclick="addComment('${post.id}')">Добавить комментарий</button>
        </div>
    `;
    
    // Админские функции
    if (canModerate || isAuthor) {
        contentHTML += `<div class="post-actions" style="margin-top: 15px;">`;
        
        if (canModerate) {
            contentHTML += `
                <button class="btn-warning" onclick="reportPost('${post.id}')">Пожаловаться</button>
                <button class="btn-danger" onclick="hidePost('${post.id}')">Скрыть пост</button>
            `;
        }
        
        if (isAuthor && post.hidden) {
            contentHTML += `<button class="btn-primary" onclick="unhidePost('${post.id}')">Восстановить пост</button>`;
        }
        
        contentHTML += `</div>`;
    }
    
    postDiv.innerHTML = contentHTML;
    return postDiv;
}

function formatPostContent(post) {
    let content = escapeHtml(post.content).replace(/\n/g, '<br>');
    
    if (post.image) {
        content += `<div class="image-preview mt-20"><img src="${post.image}" alt="Изображение поста"></div>`;
    }
    
    return content;
}

function addComment(postId) {
    if (!currentUser) {
        alert('Войдите в систему для комментирования');
        return;
    }
    
    const commentText = document.getElementById(`comment-${postId}`).value;
    if (!commentText.trim()) {
        alert('Введите текст комментария');
        return;
    }
    
    if (PostManager.addComment(postId, commentText, currentUser)) {
        saveData();
        loadPosts();
        document.getElementById(`comment-${post.id}`).value = '';
    }
}

// NSFW система
function showNSFWModal(postId) {
    document.getElementById('nsfwModal').style.display = 'block';
    document.getElementById('nsfwModal').dataset.postId = postId;
}

function closeNSFWModal() {
    document.getElementById('nsfwModal').style.display = 'none';
}

function confirmNSFW() {
    const postId = document.getElementById('nsfwModal').dataset.postId;
    document.getElementById(`nsfw-content-${postId}`).style.display = 'block';
    document.querySelector(`#post-${postId} .nsfw-warning`).style.display = 'none';
    closeNSFWModal();
}

// Админские функции
function updateUserInfo() {
    const userStatus = document.getElementById('userStatus');
    const adminPanel = document.getElementById('adminPanel');
    
    if (currentUser) {
        userStatus.textContent = `${currentUser.username} (${currentUser.type === 'guest' ? 'Гость' : 'Верифицирован'})`;
        
        if (UserManager.isAdmin(currentUser)) {
            adminPanel.style.display = 'block';
        } else {
            adminPanel.style.display = 'none';
        }
    }
}

function updateAdminStats() {
    document.getElementById('postsCount').textContent = posts.length;
    document.getElementById('usersCount').textContent = users.length;
}

function banUser() {
    if (!UserManager.isAdmin(currentUser)) return;
    
    const userInput = document.getElementById('banUserInput').value;
    if (!userInput) {
        alert('Введите имя пользователя');
        return;
    }
    
    // Находим пользователя и помечаем как забаненного
    const userToBan = users.find(u => u.username === userInput);
    if (userToBan) {
        userToBan.banned = true;
        saveData();
        alert(`Пользователь ${userInput} забанен`);
    } else {
        alert('Пользователь не найден');
    }
    
    document.getElementById('banUserInput').value = '';
}

function muteUser() {
    if (!UserManager.isAdmin(currentUser)) return;
    
    const userInput = document.getElementById('banUserInput').value;
    if (!userInput) {
        alert('Введите имя пользователя');
        return;
    }
    
    alert(`Пользователь ${userInput} получил мут на 24 часа`);
    document.getElementById('banUserInput').value = '';
}

function reportPost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    post.reports.push({
        by: currentUser.username,
        reason: 'Нарушение правил',
        timestamp: new Date().toISOString()
    });
    
    saveData();
    alert('Жалоба отправлена модераторам');
}

function hidePost(postId) {
    if (!UserManager.isAdmin(currentUser)) return;
    
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.hidden = true;
        saveData();
        loadPosts();
        alert('Пост скрыт');
    }
}

function unhidePost(postId) {
    const post = posts.find(p => p.id === postId);
    if (post && post.author === currentUser.username) {
        post.hidden = false;
        saveData();
        loadPosts();
        alert('Пост восстановлен');
    }
}

// Утилиты
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
}

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function logout() {
    currentUser = null;
    document.cookie = 'guestSession=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    switchScreen('welcomeScreen');
}

function checkOldPosts() {
    let hiddenCount = 0;
    
    posts.forEach(post => {
        if (PostManager.shouldHidePost(post)) {
            post.hidden = true;
            hiddenCount++;
        }
    });
    
    if (hiddenCount > 0) {
        saveData();
        console.log(`Скрыто ${hiddenCount} постов за отсутствие активности`);
    }
}

// Сохранение данных
function saveData() {
    localStorage.setItem('oldschool_posts', JSON.stringify(posts));
    localStorage.setItem('oldschool_users', JSON.stringify(users));
}

function loadData() {
    const savedPosts = localStorage.getItem('oldschool_posts');
    const savedUsers = localStorage.getItem('oldschool_users');
    
    posts = savedPosts ? JSON.parse(savedPosts) : [];
    users = savedUsers ? JSON.parse(savedUsers) : [];
    
    // Автоматически добавляем админа если нет
    if (!users.find(u => u.email === CONFIG.ADMIN_EMAIL)) {
        users.push(UserManager.createVerified(CONFIG.ADMIN_EMAIL));
    }
}
