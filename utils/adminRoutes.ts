export type AdminTab = 'photos' | 'stats' | 'users' | 'settings' | 'categories' | 'comments' | 'me_uploads';

export type AdminRouteResolution = {
    redirectTo?: string;
    tab?: AdminTab;
};

export const resolveAdminRoute = (pathname: string, isAdmin: boolean): AdminRouteResolution => {
    if (pathname === '/admin' || pathname === '/admin/') {
        return { redirectTo: '/admin/me/albums' };
    }

    if (!isAdmin && (pathname === '/admin/manage' || pathname.startsWith('/admin/manage/'))) {
        return { redirectTo: '/admin/me/albums' };
    }

    if (pathname.startsWith('/admin/me/albums')) return { tab: 'photos' };
    if (pathname.startsWith('/admin/me/analytics')) return { tab: 'stats' };
    if (pathname.startsWith('/admin/me/uploads')) return { tab: 'me_uploads' };
    if (pathname.startsWith('/admin/me/profile')) return { tab: 'settings' };

    if (pathname.startsWith('/admin/manage/photos')) return { tab: 'photos' };
    if (pathname.startsWith('/admin/manage/analytics')) return { tab: 'stats' };
    if (pathname.startsWith('/admin/manage/comments')) return { tab: 'comments' };
    if (pathname.startsWith('/admin/manage/users')) return { tab: 'users' };
    if (pathname.startsWith('/admin/manage/categories')) return { tab: 'categories' };
    if (pathname.startsWith('/admin/manage/settings')) return { tab: 'settings' };

    return {};
};

