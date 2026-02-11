import { API_BASE_URL } from '../api';

export const toMediaUrl = (url: string | null | undefined) => {
    if (!url) return '';
    const u = String(url).trim();
    if (!u) return '';
    
    // 如果是内网 IP 或 localhost，尝试强制走代理
    // 匹配: 192.168.x.x, 10.x.x.x, 172.16-31.x.x, 127.0.0.1, localhost
    const privateIpRegex = /^(https?:\/\/)(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)(:\d+)?/;
    
    // Helper to get safe base URL
    const getSafeBaseUrl = () => {
        if (!API_BASE_URL) return '';
        if (privateIpRegex.test(API_BASE_URL)) return '';
        return API_BASE_URL;
    };

    const safeBase = getSafeBaseUrl();

    if (privateIpRegex.test(u)) {
        // 如果是内网地址，我们无法从公网直接访问
        // 尝试剥离内网 IP 部分，只保留路径
        const path = u.replace(privateIpRegex, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${safeBase}${cleanPath}`;
    }

    if (/^https?:\/\//i.test(u)) return u;
    
    // 确保相对路径以 / 开头
    const cleanU = u.startsWith('/') ? u : `/${u}`;
    return `${safeBase}${cleanU}`;
};

export const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const v = bytes / Math.pow(1024, i);
    const fixed = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2;
    return `${v.toFixed(fixed)}${units[i]}`;
};

// 获取照片的代理地址 (优先使用)
// 这将通过后端 /media/photos/:id 接口代理访问，解决内网 IP 和 CORS 问题
export const getPhotoUrl = (photo: { id: string, url?: string, mediumUrl?: string, thumbUrl?: string } | null | undefined, variant: 'original' | 'medium' | 'thumb' = 'medium') => {
    if (!photo || !photo.id) return '';
    
    const privateIpRegex = /^(https?:\/\/)(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)(:\d+)?/;
    const safeBase = (API_BASE_URL && !privateIpRegex.test(API_BASE_URL)) ? API_BASE_URL : '';

    // 使用后端代理接口，后端会自动处理 image_url (无论是内网还是外网)
    return `${safeBase}/media/photos/${photo.id}?variant=${variant}`;
};

// 获取头像的代理地址
export const getAvatarUrl = (user: { id: string, avatar?: string } | null | undefined) => {
    if (!user || !user.id) return generateFallbackAvatar('Guest');
    
    const privateIpRegex = /^(https?:\/\/)(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)(:\d+)?/;
    const safeBase = (API_BASE_URL && !privateIpRegex.test(API_BASE_URL)) ? API_BASE_URL : '';

    // 如果是访客用户，直接返回头像 URL (通常是 ui-avatars)
    if (user.id === 'guest' && user.avatar) {
        return user.avatar;
    }

    // 如果有头像 (URL 或 bytes)，通过后端代理访问
    // 后端 /media/avatars/:id 会处理 URL 代理或直接返回 bytes
    // 添加时间戳防止缓存（如果有 updateAt 更好，这里简化处理）
    if (user.avatar) {
        return `${safeBase}/media/avatars/${user.id}`;
    }
    // 如果没有头像，返回本地生成的头像
    return generateFallbackAvatar(user['name'] || 'User');
};

// 生成本地 SVG 头像 (替代 ui-avatars.com)
export const generateFallbackAvatar = (name: string) => {
    const n = String(name || 'U').trim().substring(0, 2).toUpperCase();
    const colors = [
        '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
        '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
        '#FFC107', '#FF9800', '#FF5722', '#795548', '#607D8B'
    ];
    // 根据名字计算哈希以选择固定颜色
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
        hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];
    
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="${color}" />
        <text x="50" y="50" dy=".35em" fill="white" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" font-weight="bold">${n}</text>
    </svg>`;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
};
