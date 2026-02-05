export interface User {
  id: string;
  name: string;
  avatar: string;
  role: 'admin' | 'family';
}

export interface ExifData {
  camera: string;
  lens: string;
  aperture: string;
  shutterSpeed: string;
  iso: string;
  focalLength: string;
  location?: string;
  lat?: number;
  lng?: number;
  date: string;
}

export interface Comment {
  id: string;
  userId: string;
  user: User;
  content: string;
  timestamp: string;
}

export interface Photo {
  id: string;
  userId: string; // Added to track ownership
  url: string;
  title: string;
  description: string; // The "Story"
  exif: ExifData;
  tags: string[];
  likes: number;
  views: number;
  comments: Comment[];
  category: 'landscape' | 'portrait' | 'street' | 'travel' | 'macro' | 'uncategorized';
}
