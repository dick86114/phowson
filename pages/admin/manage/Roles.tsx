
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Shield, Plus, Search, Edit2, Trash2, Check, X, Loader2 
} from 'lucide-react';
import api from '../../../api';
import { useToast } from '../../../components/Toast';
import { EmptyState, ErrorState, LoadingState } from '../../../components/States';

interface Role {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    is_system: boolean;
    created_at?: string;
    updated_at?: string;
}

const AVAILABLE_PERMISSIONS = [
    { id: 'admin_access', label: '管理员权限 (Admin Access)' },
    { id: 'basic_access', label: '基础访问权限 (Basic Access)' },
    { id: 'guest_access', label: '访客权限 (Guest Access)' },
];

export const RolesSettings = () => {
    const queryClient = useQueryClient();
    const { success, error } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [formData, setFormData] = useState<Partial<Role>>({
        id: '',
        name: '',
        description: '',
        permissions: []
    });

    // Fetch Roles
    const { data: roles, isLoading, isError, refetch } = useQuery<Role[]>({
        queryKey: ['roles'],
        queryFn: async () => {
            const res = await api.get('/roles');
            if (!Array.isArray(res.data)) {
                throw new Error('Invalid response format: expected array');
            }
            return res.data;
        }
    });

    // Mutations
    const createRoleMutation = useMutation({
        mutationFn: (data: Partial<Role>) => api.post('/roles', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setIsModalOpen(false);
            success('角色已创建');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '创建失败'));
        }
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Role> }) => api.patch(`/roles/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setIsModalOpen(false);
            success('角色已更新');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '更新失败'));
        }
    });

    const deleteRoleMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/roles/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            success('角色已删除');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '删除失败'));
        }
    });

    // Handlers
    const handleOpenModal = (role?: Role) => {
        if (role) {
            setEditingRole(role);
            setFormData({
                id: role.id,
                name: role.name,
                description: role.description,
                permissions: role.permissions
            });
        } else {
            setEditingRole(null);
            setFormData({
                id: '',
                name: '',
                description: '',
                permissions: []
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!formData.id || !formData.name) {
            error('请填写完整信息');
            return;
        }

        if (editingRole) {
            updateRoleMutation.mutate({ id: editingRole.id, data: formData });
        } else {
            createRoleMutation.mutate(formData);
        }
    };

    const togglePermission = (permId: string) => {
        setFormData(prev => {
            const perms = new Set(prev.permissions || []);
            if (perms.has(permId)) {
                perms.delete(permId);
            } else {
                perms.add(permId);
            }
            return { ...prev, permissions: Array.from(perms) };
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    角色管理
                </h3>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-6 py-2.5 btn-liquid text-gray-900 dark:text-white font-medium hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    <span>新增角色</span>
                </button>
            </div>

            {/* List */}
            <div className="md:glass-panel md:overflow-hidden">
                {isLoading ? (
                    <LoadingState message="加载角色列表..." />
                ) : isError ? (
                    <ErrorState message="加载失败，请重试" onRetry={() => refetch()} />
                ) : roles?.length === 0 ? (
                    <EmptyState 
                        icon={Shield}
                        title="暂无角色"
                        description="还没有定义任何角色"
                    />
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/10 dark:bg-black/20 border-b border-white/10 dark:border-white/5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        <th className="px-6 py-3">ID</th>
                                        <th className="px-6 py-3">名称</th>
                                        <th className="px-6 py-3">描述</th>
                                        <th className="px-6 py-3">权限</th>
                                        <th className="px-6 py-3 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {roles?.map((role) => (
                                        <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                                {role.id}
                                                {role.is_system && (
                                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-normal">
                                                        系统
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                                {role.name}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                {role.description || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                <div className="flex flex-wrap gap-1">
                                                    {role.permissions?.map(p => (
                                                        <span key={p} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-xs">
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleOpenModal(role)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="编辑"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    {!role.is_system && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('确定要删除该角色吗？')) {
                                                                    deleteRoleMutation.mutate(role.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="删除"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-4">
                            {roles?.map((role) => (
                                <div key={role.id} className="glass-card p-5 hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900 dark:text-white text-base">
                                                {role.name}
                                            </span>
                                            {role.is_system && (
                                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium">
                                                    系统
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleOpenModal(role)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {!role.is_system && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('确定要删除该角色吗？')) {
                                                            deleteRoleMutation.mutate(role.id);
                                                        }
                                                    }}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-white/5 px-2 py-1 rounded inline-block">
                                            {role.id}
                                        </div>
                                        
                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                            {role.description || '无描述'}
                                        </div>

                                        <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">权限列表</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {role.permissions?.length > 0 ? (
                                                    role.permissions.map(p => (
                                                        <span key={p} className="px-2 py-1 rounded-md bg-gray-100 dark:bg-white/10 text-xs text-gray-600 dark:text-gray-300">
                                                            {p}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">无特殊权限</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-panel w-full max-w-lg rounded-2xl shadow-xl border border-white/20 p-6 space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingRole ? '编辑角色' : '新增角色'}
                            </h2>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    角色ID (英文标识)
                                </label>
                                <input
                                    type="text"
                                    value={formData.id}
                                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                                    disabled={!!editingRole}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
                                    placeholder="e.g. editor"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    角色名称
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder="e.g. 编辑"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    描述
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all h-24 resize-none"
                                    placeholder="角色描述..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    权限设置
                                </label>
                                <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-100 dark:border-white/5 rounded-xl">
                                    {AVAILABLE_PERMISSIONS.map(perm => (
                                        <label key={perm.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={formData.permissions?.includes(perm.id)}
                                                onChange={() => togglePermission(perm.id)}
                                                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                {perm.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                                className="px-4 py-2 btn-liquid text-gray-900 dark:text-white rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                            >
                                {(createRoleMutation.isPending || updateRoleMutation.isPending) && (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                                <span>保存</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
