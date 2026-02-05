import React from 'react';
import { Camera, Disc, Aperture, Cpu } from 'lucide-react';
import { MOCK_PHOTOS } from '../constants';

// Extract unique cameras and lenses from mock data
const getUniqueGear = () => {
    const cameras = Array.from(new Set(MOCK_PHOTOS.map(p => p.exif.camera))).map(name => ({ type: 'camera', name }));
    const lenses = Array.from(new Set(MOCK_PHOTOS.map(p => p.exif.lens))).map(name => ({ type: 'lens', name }));
    return { cameras, lenses };
};

export const Gear: React.FC = () => {
    const { cameras, lenses } = getUniqueGear();

    return (
        <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto bg-background-light dark:bg-background-dark transition-colors duration-300">
            <div className="max-w-5xl mx-auto space-y-16">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">我的装备库</h1>
                    <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        工欲善其事，必先利其器。这是我目前正在使用的摄影器材清单。
                    </p>
                </div>

                {/* Cameras Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-200 dark:border-surface-border pb-4">
                        <Camera className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">机身</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cameras.map((cam, i) => (
                            <div key={i} className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl flex items-start gap-4 hover:border-primary/50 transition-colors shadow-sm">
                                <div className="p-3 bg-gray-100 dark:bg-black/30 rounded-lg text-gray-500 dark:text-gray-300">
                                    <Camera className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{cam.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">主力全画幅相机</p>
                                    <div className="mt-4 flex gap-2">
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">高像素</span>
                                        <span className="text-xs bg-gray-100 dark:bg-surface-border text-gray-500 dark:text-gray-400 px-2 py-1 rounded">专业级</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Lenses Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-200 dark:border-surface-border pb-4">
                        <Disc className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">镜头</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lenses.map((lens, i) => (
                            <div key={i} className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl flex items-start gap-4 hover:border-primary/50 transition-colors shadow-sm">
                                <div className="p-3 bg-gray-100 dark:bg-black/30 rounded-lg text-gray-500 dark:text-gray-300">
                                    <Aperture className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{lens.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {lens.name.includes('GM') ? 'G Master 定焦/变焦镜头' : '专业级镜头'}
                                    </p>
                                    <div className="mt-4 flex gap-2">
                                         <span className="text-xs bg-gray-100 dark:bg-surface-border text-gray-500 dark:text-gray-400 px-2 py-1 rounded">锐度出色</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                
                {/* Accessories Mock */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-200 dark:border-surface-border pb-4">
                        <Cpu className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">后期与配件</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         {['MacBook Pro M2', 'EIZO ColorEdge 显示器', 'Gitzo 三脚架', 'Peak Design 背包'].map((item, i) => (
                             <div key={i} className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-4 rounded-lg text-center shadow-sm">
                                 <span className="text-sm font-medium text-gray-900 dark:text-white">{item}</span>
                             </div>
                         ))}
                    </div>
                </section>
            </div>
        </main>
    );
};