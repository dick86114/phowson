
import { Photo, User } from './types';

export const CURRENT_USER: User = {
  id: 'u1',
  name: 'Alex Chen',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCCajhVsodX70Np3Qco2tM5ZaP-b4n0BF9-ZVe6wQAQR6EZg4a_DwMI0Se2mrMSWA-LesUnXzAGrx9dgqWgya9YBqfjaGf5MOrPrgR9TComZcKo22CnFiMBQSKGW8pQaj1Uxrs68Al0QsRpD0ZeF-GqwljFW3DrPhp0MOJ1BiFyjdGOKJ3JmS-SOYlm6KJFTfL0k4I8Goxnc4wY_RbxdDXsfYovbbHxz48y6nuYk8bik7sd4h-C-c-lsxJHIXPXEwNrX5dEp6iuiJY',
  role: 'admin'
};

export const DEFAULT_CATEGORIES = [
    { value: 'landscape', label: '风光 Landscape' },
    { value: 'portrait', label: '人像 Portrait' },
    { value: 'street', label: '街头 Street' },
    { value: 'travel', label: '旅行 Travel' },
    { value: 'macro', label: '微距 Macro' },
];

export const MOCK_PHOTOS: Photo[] = [
  {
    id: 'p1',
    userId: 'u1', // Alex (Admin)
    title: '高山孤寂',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfwZccqMGeJpu747c2O79c1EKR1zzQ6wZAU3bli8esjY3UakYySE8GSkwdHEB6kCMAHaoLdY0SxL-SJJmaRHbu3nUJS-e3HjrJRRiCtF3A97cf2pQDadYtLyPkc3zHUh1eKUvSwalwgqExVug5ElyI_4898S_p0TiiTImoxFwNtpBxmEYCJg0wYiY-mvFhz_l2rOHCcLTOt0Mo5DC75EIaQRkDeVnhQUoyM6hFc5R89zQR8CXjXLuoUh4mrVQWl2MFAH3kck31Cug',
    description: '黎明时分摄于瑞士阿尔卑斯山，使用35mm镜头。薄雾初散，嶙峋的山峰显露真容。这张照片捕捉到了大自然最原始的静谧时刻，让人感受到人类的渺小与自然的伟大。',
    category: 'landscape',
    tags: ['雪山', '风景', '清晨', '瑞士'],
    likes: 128,
    views: 1042,
    exif: {
      camera: 'Sony A7R IV',
      lens: 'FE 35mm F1.4 GM',
      aperture: 'f/8',
      shutterSpeed: '1/200s',
      iso: '100',
      focalLength: '35mm',
      location: '采尔马特，瑞士',
      date: '2023-10-24',
      lat: 45.976,
      lng: 7.658
    },
    comments: []
  },
  {
    id: 'p2',
    userId: 'u2', // Sarah (Family) - Demo for family user content
    title: '镜湖',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaPE_p2MYxvo6HcUEP0VTkSBjxpr1n9nj0lPSaWrJNZLrs4Glej3AFdXrm7f-i_FgkJyPoQEovnD18Gb7Si-YbBB53zEt0C6NWyJ3hMRsOFsOWdXPX-Oqd8UHyZXjL2m9k7GvyIEAezF50eKCPuG1MHHPebaTUoXzx4uGcgsQA0eZFxQjXQ5QF4svWZEuIeVNPzwGgsmIiO6lOAtw-1H1n4L8omF071bnI-NMRQLgwwVDb7FcP66fQW6vzpcEs8ExUs8_4XObi4G8',
    description: '班夫国家公园的经典倒影。',
    category: 'landscape',
    tags: ['倒影', '湖泊', '加拿大'],
    likes: 85,
    views: 560,
    exif: {
      camera: 'Canon EOS R5',
      lens: 'RF 24-70mm',
      aperture: 'f/11',
      shutterSpeed: '1/60s',
      iso: '200',
      focalLength: '24mm',
      location: '班夫，加拿大',
      date: '2023-09-15',
      lat: 51.178,
      lng: -115.570
    },
    comments: []
  },
  {
    id: 'p3',
    userId: 'u1', // Alex (Admin)
    title: '码头日落',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCNKVg4EqCGDCHoDOWR1uCJqHMofmrjrzkHlKD03ybqhmzVIeJaCStgf88P4Qf741GqkxdYaYLAlk5uRYhciokMkCSptR-4xT8OW-546N48SyKOyfGUbg73zb2RC0DaktRseJbmqpdpr1g9hCH0X2T8orMHIAksK1oQG7IZ5j296xiAsx8SOIs7DlAWOrOuDn-sYdO87fIuFmNs6Gi4kl_ULZyPaNWmAQtsWSBX6_pHqlp0QOFojQf27pzDe8hHBzt9Xp7MxCxB4ro',
    description: '为了等到光线完美照射在水面上的那一刻，我足足等了近三个小时。这张照片代表了城市喧嚣中的片刻宁静。当太阳沉入地平线的那一刻，码头突然被平静笼罩。色彩在瞬间爆发成这种充满活力的紫色和橙色渐变，整个过程大概只持续了不到五分钟。',
    category: 'landscape',
    tags: ['日落', '大海', '宁静', '长曝光'],
    likes: 242,
    views: 3500,
    exif: {
      camera: 'Sony A7IV',
      lens: '35mm GM',
      aperture: 'f/1.8',
      shutterSpeed: '1/200s',
      iso: '100',
      focalLength: '35mm',
      location: '加州圣莫尼卡',
      date: '2023-10-12',
      lat: 34.019,
      lng: -118.491
    },
    comments: [
        {
            id: 'c1',
            userId: 'u2',
            user: { id: 'u2', name: 'Sarah Jenkins', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqcXmQUfPydHCXbY--cJ-8nhjfb3Gqrmx7V94XVPuZGwLsYOapH9YalaRipvFCufvUrwTZ6upGZcAW1BkqO3CLA9fW1tVHRLgYzJTatZfiMx-U4puTQrm6317oRkQ1Vb_xD2aqmyssM_3EBU1xhDfr9PLKK7p3VGTpb779F0pW6AM_8Dy90__1xjjjqEq1y8XZTlYFiAGU9E_CbTBEGPWdH7KmJsGd8m-cr07X1d8NqXP1q2kUFhwTlTLEv-8o57gHzmdXs_HCJek', role: 'family' },
            content: '天空的颜色真是美极了！这是上个月我们去海边旅行时拍的吗？',
            timestamp: '2小时前'
        },
        {
            id: 'c2',
            userId: 'u3',
            user: { id: 'u3', name: 'Mike Ross', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBN2irZr7NpNvLV21He6bW-EtRoUfZI5sRBlpaO_jyGrH0Okd5SDovCmIj5o_RtTPMNd4xLDC_-BaowCrL8MHjRRkf6OAzelPg1AwbgW5gp3lqc4kzjxC5vkPwPsqXCoP4BxlBu_a6jk46JvZ7ds5LWhReclyKUTk0g-BgrmH-2trfCtEF1vE_sUcuO2DJFMBhD3SZ9kZFSJoQVYALTm-7m5rsqwtuiX752aE-3w6Edc7THNZHIDf0fRXd3mtpzokp600q8WD5DAeg', role: 'family' },
            content: '拍得太棒了。我喜欢水面看起来那么平静的感觉。你应该把这张装裱起来挂在客厅。',
            timestamp: '5小时前'
        }
    ]
  },
  {
    id: 'p4',
    userId: 'u1', // Alex (Admin)
    title: '巨人之谷',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOEKNSfJUmrDj_PT7aZ2W3Vx_5-ACMZbCelKUkAUXCpkJZJhNYQw8Zdoc_05fF8KBIpk21PGB6UXpkZ7SxGS9M_R3K1fYjJ0HP1BppR-jjn40WNTvEfe8KAwhPwaGpU4_VCXHMoBMWiZak_sM4030UijodYQFXNp4NmCXCOjjHqybtQB8oDr3SdufzvSN3tIkRmM1C-sWGSSJmTqllQ4Ek5bAJjQssGNxRCCjprCRbDTO_BCgy9b2GyM7qAUC3vcBQZiqJiJzkgNA',
    description: '优胜美地的壮阔景象。',
    category: 'landscape',
    tags: ['国家公园', '美国', '山谷'],
    likes: 56,
    views: 320,
    exif: {
      camera: 'Nikon Z7 II',
      lens: 'Z 14-24mm f/2.8',
      aperture: 'f/5.6',
      shutterSpeed: '1/125s',
      iso: '64',
      focalLength: '14mm',
      location: '优胜美地，美国',
      date: '2023-08-30'
    },
    comments: []
  },
  {
    id: 'p5',
    userId: 'u2', // Sarah (Family)
    title: '步入深林',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCFynGJKs9ngKVmTlIxAGwCxjJDQWNYnz-UKaYgBBMxqHqILDlvv2xDtXEI1b-4tczde0cFHM14v2XK-hsyaT33Jna0FsdOKXCe4uokdNxSQqKXp9STKOPDSEy-SnRbQ44eENh3YC_gqo-4gM-tzJlFCYN4_C_aPb0459Am1xKpL8d7X-n8r2XYf6hR_u-4CMDHTkyU3hhiZARr_R2-XaeE42EzTQqEVJB-e7B8cTGl2T5L4yLteo8mnL1jCyvua_Enyd-rIE8UxLU',
    description: '德国黑森林的光影游戏。',
    category: 'landscape',
    tags: ['森林', '光线', '德国'],
    likes: 92,
    views: 450,
    exif: {
      camera: 'Fujifilm X-T4',
      lens: 'XF 16-55mm',
      aperture: 'f/4',
      shutterSpeed: '1/60s',
      iso: '400',
      focalLength: '23mm',
      location: '黑森林，德国',
      date: '2023-09-02'
    },
    comments: []
  },
  {
      id: 'p6',
      userId: 'u1', // Alex (Admin)
      title: '霓虹灵魂',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBumTLHmMZt-33zahowXHr-c3rMMlFwSnXrGtuiwmMH_n299-Y8UHHUsFWV2bzUDQ378apP-Wxpuy2XtFzLFHClSXhWEKOqqn7bSTXS5uAnR2joQWK9jmhyOwFNTjJkj6t91jPyELlU0ovKldLVAw8sRww4DUU50mGX2vj1386e8AVITMiR-0i7FybyOwIG7IhTwNNxY5GmrGq25JQd-6j7K3Hu403FJb8-LpxuZJRyp8M4BDLX23uNqin3MQd1T2XvgfninXJgK0s',
      description: '使用红色霓虹灯作为主光源的人像创作。',
      category: 'portrait',
      tags: ['人像', '霓虹', '创意'],
      likes: 110,
      views: 890,
      exif: {
        camera: 'Sony A7IV',
        lens: '85mm f/1.4 GM',
        aperture: 'f/1.4',
        shutterSpeed: '1/100s',
        iso: '800',
        focalLength: '85mm',
        location: '摄影棚',
        date: '2023-11-01'
      },
      comments: []
    }
];
